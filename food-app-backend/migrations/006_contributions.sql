-- Up Migration
-- Account deletion: user_id → SET NULL (rating stays, anonymous); the service also
-- clears review_text / text_embedding in the same transaction (Phase 8).

CREATE TABLE dish_ratings (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            BIGINT REFERENCES users (id) ON DELETE SET NULL,
  menu_item_id       BIGINT NOT NULL REFERENCES menu_items (id) ON DELETE RESTRICT,
  stars              SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  would_order_again  BOOLEAN NOT NULL,
  taste              SMALLINT CHECK (taste BETWEEN 1 AND 5),
  portion            SMALLINT CHECK (portion BETWEEN 1 AND 5),
  value              SMALLINT CHECK (value BETWEEN 1 AND 5),
  spice              TEXT CHECK (spice IN ('mild', 'medium', 'spicy', 'very_spicy')),
  sweetness          TEXT CHECK (sweetness IN ('low', 'medium', 'high')),
  oiliness           TEXT CHECK (oiliness IN ('low', 'medium', 'high')),
  review_text        TEXT CHECK (char_length(review_text) <= 1000),
  price_paid         INTEGER CHECK (price_paid > 0),
  is_current         BOOLEAN NOT NULL DEFAULT true,   -- re-rate after 30 days: old row kept as history
  deleted_at         TIMESTAMPTZ,                     -- admin soft delete
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One current rating per user per menu item
CREATE UNIQUE INDEX dish_ratings_one_current_idx
  ON dish_ratings (user_id, menu_item_id) WHERE is_current;

-- Yes/no facilities: NULL = not answered; false = answered "no".
CREATE TABLE place_reviews (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT REFERENCES users (id) ON DELETE SET NULL,
  place_id        BIGINT NOT NULL REFERENCES places (id) ON DELETE RESTRICT,
  stars           SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  vibe            SMALLINT CHECK (vibe BETWEEN 1 AND 5),
  looks           SMALLINT CHECK (looks BETWEEN 1 AND 5),
  service_speed   SMALLINT CHECK (service_speed BETWEEN 1 AND 5),
  staff           SMALLINT CHECK (staff BETWEEN 1 AND 5),
  hygiene         SMALLINT CHECK (hygiene BETWEEN 1 AND 5),
  noise           TEXT CHECK (noise IN ('quiet', 'moderate', 'loud')),
  wifi            BOOLEAN,
  plug_points     BOOLEAN,
  ac              BOOLEAN,
  washroom        BOOLEAN,
  bike_parking    BOOLEAN,
  car_parking     BOOLEAN,
  accepts_cash    BOOLEAN,
  accepts_upi     BOOLEAN,
  accepts_card    BOOLEAN,
  crowd           TEXT CHECK (crowd IN ('empty', 'okay', 'packed')),
  review_text     TEXT CHECK (char_length(review_text) <= 1000),
  text_embedding  vector(768),
  is_current      BOOLEAN NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One current review per user per place
CREATE UNIQUE INDEX place_reviews_one_current_idx
  ON place_reviews (user_id, place_id) WHERE is_current;

-- A photo belongs to exactly one parent: a dish rating, a place review or a place.
CREATE TABLE photos (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url                   TEXT NOT NULL,
  cloudinary_public_id  TEXT NOT NULL,
  dish_rating_id        BIGINT REFERENCES dish_ratings (id) ON DELETE CASCADE,
  place_review_id       BIGINT REFERENCES place_reviews (id) ON DELETE CASCADE,
  place_id              BIGINT REFERENCES places (id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(dish_rating_id, place_review_id, place_id) = 1)
);

-- User ticks ("Good for: …") and code-rule guesses (source = auto) in one table.
-- PK = one vote per user per tag per place.
CREATE TABLE place_tag_votes (
  place_id    BIGINT NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  tag_id      BIGINT NOT NULL REFERENCES tags (id) ON DELETE RESTRICT,
  user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source      TEXT NOT NULL CHECK (source IN ('user', 'auto')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, tag_id, user_id)
);

-- Down Migration
DROP TABLE place_tag_votes;
DROP TABLE photos;
DROP TABLE place_reviews;
DROP TABLE dish_ratings;
