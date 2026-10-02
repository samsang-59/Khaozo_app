-- Up Migration

-- Only the owner can ever see a note. About exactly one thing: a place or a menu item.
CREATE TABLE private_notes (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  place_id      BIGINT REFERENCES places (id) ON DELETE CASCADE,
  menu_item_id  BIGINT REFERENCES menu_items (id) ON DELETE CASCADE,
  text          TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(place_id, menu_item_id) = 1)
);

-- Save a place, a menu item or a standard dish. tried_at set when the user rates it.
CREATE TABLE wishlist_items (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  place_id          BIGINT REFERENCES places (id) ON DELETE CASCADE,
  menu_item_id      BIGINT REFERENCES menu_items (id) ON DELETE CASCADE,
  standard_dish_id  BIGINT REFERENCES standard_dishes (id) ON DELETE CASCADE,
  tried_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(place_id, menu_item_id, standard_dish_id) = 1),
  -- no duplicate saves per user (NULLS NOT DISTINCT: the two empty columns count as equal)
  UNIQUE NULLS NOT DISTINCT (user_id, place_id, menu_item_id, standard_dish_id)
);

-- Saved only when a winner is picked. Guests are never stored, only counted.
CREATE TABLE group_sessions (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  created_by        BIGINT REFERENCES users (id) ON DELETE SET NULL,
  location_label    TEXT,
  location          GEOGRAPHY(Point, 4326),
  winning_place_id  BIGINT NOT NULL REFERENCES places (id) ON DELETE RESTRICT,
  guest_count       INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Logged-in members only
CREATE TABLE group_session_members (
  group_session_id  BIGINT NOT NULL REFERENCES group_sessions (id) ON DELETE CASCADE,
  user_id           BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at         TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_session_id, user_id)
);

-- Down Migration
DROP TABLE group_session_members;
DROP TABLE group_sessions;
DROP TABLE wishlist_items;
DROP TABLE private_notes;
