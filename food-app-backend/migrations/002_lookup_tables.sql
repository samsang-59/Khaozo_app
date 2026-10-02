-- Up Migration
-- Lookup tables + must-have rows. Growing lists are tables (not CHECK lists).

CREATE TABLE areas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  location    GEOGRAPHY(Point, 4326) NOT NULL,   -- one centre pin per locality
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cuisines (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dish_categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE main_ingredients (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('mood', 'meal_time')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, type)
);

-- Business rules live here (admin can change them, cached in Redis).
-- Secrets never go here — they stay in .env.
-- value is JSONB because some rules are numbers and some are small objects.
-- updated_by → users is added in 003 (users doesn't exist yet).
CREATE TABLE config_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  updated_by   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Must-have rows ------------------------------------------------------------

INSERT INTO tags (name, type) VALUES
  ('Work', 'mood'), ('Study', 'mood'), ('Date', 'mood'), ('Family', 'mood'),
  ('Friends', 'mood'), ('Solo', 'mood'), ('Quick bite', 'mood'), ('Late night', 'mood'),
  ('Celebration', 'mood'), ('Budget', 'mood'),
  ('Breakfast', 'meal_time'), ('Lunch', 'meal_time'), ('Evening snacks', 'meal_time'),
  ('Dinner', 'meal_time'), ('Late night', 'meal_time');

INSERT INTO config_settings (key, value, description) VALUES
  ('place_verify_threshold', '5', 'Sum of confirmation weights needed to verify a place'),
  ('trust_weights', '{"new": 0.5, "normal": 1.0, "trusted": 2.0}', 'Weight per trust level (confirmations, ratings, reviews)'),
  ('min_ratings_for_label', '5', 'Ratings needed before a Must order / Mixed reviews label'),
  ('must_order', '{"minStars": 4, "minOrderAgainPct": 70}', 'Must order: stars >= minStars AND order-again % >= minOrderAgainPct'),
  ('mixed_reviews', '{"maxStars": 2.5, "belowOrderAgainPct": 40}', 'Mixed reviews: stars <= maxStars OR order-again % < belowOrderAgainPct'),
  ('rerate_after_days', '30', 'Days before a fresh rating/review replaces the current one'),
  ('journal_gap_hours', '3', 'Gap that starts a new journal card for the same place'),
  ('tag_min_votes', '3', 'Votes needed before a mood / meal-time tag is shown'),
  ('summary_refresh_every', '5', 'New text reviews that trigger an AI summary refresh'),
  ('group_expiry_hours', '4', 'Live group session lifetime in Redis');

-- Catalog rows (source of truth: plans/08_dish_catalog.md, reviewed 2 Oct 2026)
INSERT INTO cuisines (name) VALUES
  ('Odia'),
  ('North Indian'),
  ('South Indian'),
  ('Mughlai'),
  ('Chinese'),
  ('Continental'),
  ('Street food'),
  ('Bakery & desserts'),
  ('Fast food'),
  ('Beverages');

INSERT INTO dish_categories (name) VALUES
  ('Biryani'),
  ('Momos'),
  ('Dosa'),
  ('Rolls'),
  ('Thali'),
  ('Chhena sweets'),
  ('Rice & Pulao'),
  ('Curry'),
  ('Veg curry'),
  ('Dal'),
  ('Breads'),
  ('Idli & Vada'),
  ('South Indian tiffin'),
  ('Noodles'),
  ('Fried rice'),
  ('Chinese starters'),
  ('Soup'),
  ('Chaat'),
  ('Fritters & snacks'),
  ('Kebab & Tandoori'),
  ('Fry'),
  ('Pitha'),
  ('Sweets'),
  ('Pizza'),
  ('Burger'),
  ('Sandwich'),
  ('Pasta'),
  ('Cakes & pastries'),
  ('Drinks');

INSERT INTO main_ingredients (name) VALUES
  ('Chicken'),
  ('Mutton'),
  ('Fish'),
  ('Prawn'),
  ('Egg'),
  ('Paneer'),
  ('Mushroom'),
  ('Crab'),
  ('Chhena');

-- Down Migration
DROP TABLE config_settings;
DROP TABLE tags;
DROP TABLE main_ingredients;
DROP TABLE dish_categories;
DROP TABLE cuisines;
DROP TABLE areas;
