-- Up Migration

-- Standard dish = the fair-comparison level ("Chicken Dum Biryani").
-- Category = dish type only; cuisine sits here. diet is its own column (Dal has no main ingredient).
CREATE TABLE standard_dishes (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  category_id         BIGINT NOT NULL REFERENCES dish_categories (id) ON DELETE RESTRICT,
  cuisine_id          BIGINT NOT NULL REFERENCES cuisines (id) ON DELETE RESTRICT,
  main_ingredient_id  BIGINT REFERENCES main_ingredients (id) ON DELETE RESTRICT,
  diet                TEXT NOT NULL CHECK (diet IN ('veg', 'egg', 'non_veg')),
  embedding           vector(768),                    -- Gemini embedding of the name (Phase 6)
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_review')),
  created_by          BIGINT REFERENCES users (id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per spelling; one spelling → exactly one dish.
CREATE TABLE dish_aliases (
  alias             TEXT PRIMARY KEY CHECK (alias = lower(alias)),
  standard_dish_id  BIGINT NOT NULL REFERENCES standard_dishes (id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What the place actually sells. Variants allowed (several menu items per standard dish).
-- price = latest full-plate price in rupees (overwritten; history lives in dish_ratings.price_paid).
CREATE TABLE menu_items (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id            BIGINT NOT NULL REFERENCES places (id) ON DELETE RESTRICT,
  standard_dish_id    BIGINT NOT NULL REFERENCES standard_dishes (id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  price               INTEGER CHECK (price > 0),
  ai_summary          TEXT,
  summary_updated_at  TIMESTAMPTZ,
  added_by            BIGINT REFERENCES users (id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE menu_items;
DROP TABLE dish_aliases;
DROP TABLE standard_dishes;
