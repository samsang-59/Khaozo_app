-- Up Migration
-- Delete rules: places are never hard-deleted in normal use (soft delete via deleted_at,
-- closed via status). Pure attributes of a place CASCADE; anything users contributed
-- about a place RESTRICTs so it can't vanish by accident.

CREATE TABLE places (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  location     GEOGRAPHY(Point, 4326) NOT NULL,
  address      TEXT,
  area_id      BIGINT NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,  -- nearest area pin, set once
  place_type   TEXT NOT NULL CHECK (place_type IN ('restaurant', 'cafe', 'dhaba', 'bakery', 'street_stall', 'sweet_shop')),
  diet_type    TEXT CHECK (diet_type IN ('pure_veg', 'non_veg', 'both')),
  price_level  SMALLINT CHECK (price_level BETWEEN 1 AND 4),               -- ₹ to ₹₹₹₹, imports start empty
  phone        TEXT,
  source       TEXT NOT NULL CHECK (source IN ('osm', 'foursquare', 'user')),
  source_ref   TEXT,                                                       -- OSM / Foursquare id
  added_by     BIGINT REFERENCES users (id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'closed')),
  verified_at  TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,                                                -- admin soft delete
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref)
);

CREATE TABLE place_cuisines (
  place_id    BIGINT NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  cuisine_id  BIGINT NOT NULL REFERENCES cuisines (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, cuisine_id)
);

-- day: 0 = Sunday … 6 = Saturday (same as JS getDay() and Postgres EXTRACT(DOW)).
-- Two shifts = two rows. closes_at < opens_at = closes after midnight. No rows = hours unknown.
CREATE TABLE opening_hours (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id    BIGINT NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  day         SMALLINT NOT NULL CHECK (day BETWEEN 0 AND 6),
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (opens_at <> closes_at)
);

-- "Yes, this place exists". weight = snapshot of the confirmer's trust at that moment.
-- PK = one confirmation per user per place.
CREATE TABLE place_confirmations (
  place_id      BIGINT NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  confirmed_by  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  weight        DOUBLE PRECISION NOT NULL CHECK (weight > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, confirmed_by)
);

-- suggested_change is JSONB: its shape depends on the reason (new hours, new pin, …).
CREATE TABLE place_reports (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id          BIGINT NOT NULL REFERENCES places (id) ON DELETE RESTRICT,
  reported_by       BIGINT REFERENCES users (id) ON DELETE SET NULL,
  reason            TEXT NOT NULL CHECK (reason IN ('closed', 'not_found', 'wrong_location', 'wrong_hours', 'wrong_info', 'duplicate')),
  details           TEXT,
  suggested_change  JSONB,
  duplicate_of      BIGINT REFERENCES places (id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by       BIGINT REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reason <> 'duplicate' OR duplicate_of IS NOT NULL)
);

-- Down Migration
DROP TABLE place_reports;
DROP TABLE place_confirmations;
DROP TABLE opening_hours;
DROP TABLE place_cuisines;
DROP TABLE places;
