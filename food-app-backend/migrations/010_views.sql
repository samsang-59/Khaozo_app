-- Up Migration
-- Ranking numbers live in two materialized views (saved query results), refreshed every
-- ~5 min by a background job with REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- All ranking maths is here, in one SQL file. Rules are read from config_settings at refresh time.

-- Rules the plan names but leaves open (admin-editable):
INSERT INTO config_settings (key, value, description) VALUES
  ('bayes_prior', '{"mean": 3.5, "weight": 5}',
   'Bayesian average: every dish starts as if it had `weight` ratings of `mean` stars'),
  ('trust_rules', '{"agreeWithin": 1.0, "farOff": 2.5, "agreeBonus": 0.05, "farPenalty": 0.2, "verifiedPlaceBonus": 0.1, "min": 0.1, "max": 3.0}',
   'Trust score = 1 + agreeBonus × ratings within agreeWithin★ of the crowd − farPenalty × ratings ≥ farOff★ away + verifiedPlaceBonus × places added that got verified, clamped to [min, max]');

-- Weight of each current rating / review, from the author's CURRENT trust (never a snapshot):
--   level weight (trust_weights: new / normal / trusted) × LEAST(trust_score, 1)
--   → a spammer whose trust drops shrinks all their old ratings automatically.
--   Anonymised rows (deleted account) count as normal.
CREATE VIEW contribution_weights AS
WITH cfg AS (
  SELECT
    (SELECT value FROM config_settings WHERE key = 'trust_weights') AS tw,
    (SELECT (value #>> '{}')::int FROM config_settings WHERE key = 'new_account_days') AS new_days,
    (SELECT (value #>> '{}')::float FROM config_settings WHERE key = 'trusted_min_score') AS trusted_min
)
SELECT u.id AS user_id,
  CASE
    WHEN u.created_at > now() - make_interval(days => cfg.new_days) THEN (cfg.tw ->> 'new')::float * LEAST(u.trust_score, 1)
    WHEN u.trust_score >= cfg.trusted_min THEN (cfg.tw ->> 'trusted')::float
    ELSE (cfg.tw ->> 'normal')::float * LEAST(u.trust_score, 1)
  END AS weight
FROM users u CROSS JOIN cfg;

CREATE MATERIALIZED VIEW menu_item_stats AS
WITH cfg AS (
  SELECT
    (SELECT value FROM config_settings WHERE key = 'trust_weights') AS tw,
    (SELECT value FROM config_settings WHERE key = 'bayes_prior') AS prior,
    (SELECT (value #>> '{}')::int FROM config_settings WHERE key = 'min_ratings_for_label') AS min_label,
    (SELECT value FROM config_settings WHERE key = 'must_order') AS must,
    (SELECT value FROM config_settings WHERE key = 'mixed_reviews') AS mixed
), w AS (
  SELECT r.menu_item_id, r.stars, r.would_order_again, r.spice, r.sweetness, r.oiliness,
         COALESCE(cw.weight, (cfg.tw ->> 'normal')::float) AS weight
  FROM dish_ratings r
  CROSS JOIN cfg
  LEFT JOIN contribution_weights cw ON cw.user_id = r.user_id
  WHERE r.is_current AND r.deleted_at IS NULL
), agg AS (
  SELECT menu_item_id,
         COUNT(*) AS rating_count,
         SUM(weight) AS weight_sum,
         SUM(weight * stars) / NULLIF(SUM(weight), 0) AS avg_stars,
         100.0 * COALESCE(SUM(weight) FILTER (WHERE would_order_again), 0) / NULLIF(SUM(weight), 0) AS order_again_pct,
         mode() WITHIN GROUP (ORDER BY spice) FILTER (WHERE spice IS NOT NULL) AS typical_spice,
         mode() WITHIN GROUP (ORDER BY sweetness) FILTER (WHERE sweetness IS NOT NULL) AS typical_sweetness,
         mode() WITHIN GROUP (ORDER BY oiliness) FILTER (WHERE oiliness IS NOT NULL) AS typical_oiliness
  FROM w GROUP BY menu_item_id
)
SELECT m.id AS menu_item_id,
       m.place_id,
       m.standard_dish_id,
       COALESCE(a.rating_count, 0)::int AS rating_count,
       round(a.avg_stars::numeric, 2)::float AS avg_stars,
       round(a.order_again_pct::numeric, 1)::float AS order_again_pct,
       -- Bayesian average: (prior_weight × prior_mean + Σ weight × stars) / (prior_weight + Σ weight)
       round((((cfg.prior ->> 'weight')::float * (cfg.prior ->> 'mean')::float + COALESCE(a.weight_sum * a.avg_stars, 0))
              / ((cfg.prior ->> 'weight')::float + COALESCE(a.weight_sum, 0)))::numeric, 3)::float AS bayes_score,
       CASE
         WHEN COALESCE(a.rating_count, 0) < cfg.min_label THEN NULL
         WHEN a.avg_stars >= (cfg.must ->> 'minStars')::float
              AND a.order_again_pct >= (cfg.must ->> 'minOrderAgainPct')::float THEN 'must_order'
         WHEN a.avg_stars <= (cfg.mixed ->> 'maxStars')::float
              OR a.order_again_pct < (cfg.mixed ->> 'belowOrderAgainPct')::float THEN 'mixed_reviews'
       END AS label,
       a.typical_spice,
       a.typical_sweetness,
       a.typical_oiliness
FROM menu_items m
CROSS JOIN cfg
LEFT JOIN agg a ON a.menu_item_id = m.id
WHERE m.status = 'active';

CREATE UNIQUE INDEX menu_item_stats_pk ON menu_item_stats (menu_item_id);   -- needed for CONCURRENTLY
CREATE INDEX menu_item_stats_dish_idx ON menu_item_stats (standard_dish_id, bayes_score DESC);
CREATE INDEX menu_item_stats_place_idx ON menu_item_stats (place_id);

-- Facilities = majority answer of current reviews (yes > no → true, no > yes → false, tie / none → null).
CREATE MATERIALIZED VIEW place_stats AS
WITH cfg AS (
  SELECT
    (SELECT value FROM config_settings WHERE key = 'trust_weights') AS tw,
    (SELECT (value #>> '{}')::int FROM config_settings WHERE key = 'tag_min_votes') AS tag_min
), v AS (
  SELECT r.*, COALESCE(cw.weight, (cfg.tw ->> 'normal')::float) AS weight
  FROM place_reviews r
  CROSS JOIN cfg
  LEFT JOIN contribution_weights cw ON cw.user_id = r.user_id
  WHERE r.is_current AND r.deleted_at IS NULL
), agg AS (
  SELECT place_id,
         COUNT(*) AS review_count,
         SUM(weight * stars) / NULLIF(SUM(weight), 0) AS avg_stars,
         AVG(vibe) AS avg_vibe, AVG(looks) AS avg_looks, AVG(service_speed) AS avg_service_speed,
         AVG(staff) AS avg_staff, AVG(hygiene) AS avg_hygiene,
         mode() WITHIN GROUP (ORDER BY noise) FILTER (WHERE noise IS NOT NULL) AS noise,
         mode() WITHIN GROUP (ORDER BY crowd) FILTER (WHERE crowd IS NOT NULL) AS crowd,
         SIGN(COUNT(*) FILTER (WHERE wifi) - COUNT(*) FILTER (WHERE NOT wifi)) AS wifi,
         SIGN(COUNT(*) FILTER (WHERE plug_points) - COUNT(*) FILTER (WHERE NOT plug_points)) AS plug_points,
         SIGN(COUNT(*) FILTER (WHERE ac) - COUNT(*) FILTER (WHERE NOT ac)) AS ac,
         SIGN(COUNT(*) FILTER (WHERE washroom) - COUNT(*) FILTER (WHERE NOT washroom)) AS washroom,
         SIGN(COUNT(*) FILTER (WHERE bike_parking) - COUNT(*) FILTER (WHERE NOT bike_parking)) AS bike_parking,
         SIGN(COUNT(*) FILTER (WHERE car_parking) - COUNT(*) FILTER (WHERE NOT car_parking)) AS car_parking,
         SIGN(COUNT(*) FILTER (WHERE accepts_cash) - COUNT(*) FILTER (WHERE NOT accepts_cash)) AS accepts_cash,
         SIGN(COUNT(*) FILTER (WHERE accepts_upi) - COUNT(*) FILTER (WHERE NOT accepts_upi)) AS accepts_upi,
         SIGN(COUNT(*) FILTER (WHERE accepts_card) - COUNT(*) FILTER (WHERE NOT accepts_card)) AS accepts_card
  FROM v GROUP BY place_id
), tags AS (
  SELECT t.place_id, array_agg(t.tag_id ORDER BY t.votes DESC, t.tag_id) AS tag_ids
  FROM (SELECT place_id, tag_id, COUNT(*) AS votes FROM place_tag_votes GROUP BY place_id, tag_id) t
  CROSS JOIN cfg
  WHERE t.votes >= cfg.tag_min
  GROUP BY t.place_id
)
SELECT p.id AS place_id,
       COALESCE(a.review_count, 0)::int AS review_count,
       round(a.avg_stars::numeric, 2)::float AS avg_stars,
       round(a.avg_vibe::numeric, 1)::float AS avg_vibe,
       round(a.avg_looks::numeric, 1)::float AS avg_looks,
       round(a.avg_service_speed::numeric, 1)::float AS avg_service_speed,
       round(a.avg_staff::numeric, 1)::float AS avg_staff,
       round(a.avg_hygiene::numeric, 1)::float AS avg_hygiene,
       a.noise, a.crowd,
       CASE a.wifi WHEN 1 THEN true WHEN -1 THEN false END AS wifi,
       CASE a.plug_points WHEN 1 THEN true WHEN -1 THEN false END AS plug_points,
       CASE a.ac WHEN 1 THEN true WHEN -1 THEN false END AS ac,
       CASE a.washroom WHEN 1 THEN true WHEN -1 THEN false END AS washroom,
       CASE a.bike_parking WHEN 1 THEN true WHEN -1 THEN false END AS bike_parking,
       CASE a.car_parking WHEN 1 THEN true WHEN -1 THEN false END AS car_parking,
       CASE a.accepts_cash WHEN 1 THEN true WHEN -1 THEN false END AS accepts_cash,
       CASE a.accepts_upi WHEN 1 THEN true WHEN -1 THEN false END AS accepts_upi,
       CASE a.accepts_card WHEN 1 THEN true WHEN -1 THEN false END AS accepts_card,
       COALESCE(tags.tag_ids, '{}') AS tag_ids
FROM places p
LEFT JOIN agg a ON a.place_id = p.id
LEFT JOIN tags ON tags.place_id = p.id
WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX place_stats_pk ON place_stats (place_id);

-- Down Migration
DROP MATERIALIZED VIEW place_stats;
DROP MATERIALIZED VIEW menu_item_stats;
DROP VIEW contribution_weights;
DELETE FROM config_settings WHERE key IN ('bayes_prior', 'trust_rules');
