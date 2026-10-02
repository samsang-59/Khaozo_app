-- Up Migration
-- Search, AI and rate-limit rules (Phase 6). The plan says these are config values;
-- the exact numbers not given by the plan are marked "ours" in plans/06_phase_plan.md.
INSERT INTO config_settings (key, value, description) VALUES
  ('search_weights', '{"dish": 0.40, "distance": 0.20, "tag": 0.15, "taste": 0.10, "vibe": 0.10, "open": 0.05}',
   'Search ranking weights (plan): dish score · distance · mood/tag fit · taste match · vibe · open/time'),
  ('search_radius_m', '{"start": 3000, "relaxed": 6000}',
   'Search radius in metres; relaxed once (3 → 6 km) when fewer than 3 results'),
  ('search_relax_price_pct', '20', 'Relax step: raise the max price by this percent'),
  ('search_min_results', '3', 'Relax filters (one step at a time) while results are fewer than this'),
  ('ai_daily_limit', '{"gemini": 500}',
   'Daily Gemini calls before switching to the fallback (stay under the free-tier limit)'),
  ('rate_limits', '{
     "api":      {"user": [120, 60],   "ip": [300, 60]},
     "search":   {"user": [20, 60],    "ip": [60, 60]},
     "auth":     {"ip": [20, 60]},
     "contribute": {"user": [30, 3600]},
     "addPlace": {"user": [5, 86400]},
     "createGroup": {"user": [10, 3600], "ip": [10, 3600]},
     "socket":   {"conn": [5, 1]}
   }',
   'Rate limits as [max requests, window seconds] per user (logged in) or per IP (guest)');

-- Down Migration
DELETE FROM config_settings WHERE key IN
  ('search_weights', 'search_radius_m', 'search_relax_price_pct', 'search_min_results', 'ai_daily_limit', 'rate_limits');
