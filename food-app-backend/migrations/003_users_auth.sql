-- Up Migration

CREATE TABLE users (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  google_id           TEXT NOT NULL UNIQUE,
  avatar_url          TEXT,
  role                TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  trust_score         DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (trust_score >= 0),
  journal_visibility  TEXT NOT NULL DEFAULT 'private' CHECK (journal_visibility IN ('public', 'private')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE config_settings
  ADD CONSTRAINT config_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

-- 1:1 with users. Quiz and learned values are both stored; the app blends them.
-- <field>_locked = user edited it → background jobs never change it again.
-- Scales: spice 1–4 (mild → very spicy) · sweet 1–3 · oiliness 1–3 · budget 1–4
-- (<₹150 / ₹150–300 / ₹300–600 / ₹600+). diet is never learned.
CREATE TABLE taste_profiles (
  user_id           BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  diet              TEXT CHECK (diet IN ('veg', 'egg', 'non_veg')),
  spice_quiz        SMALLINT CHECK (spice_quiz BETWEEN 1 AND 4),
  spice_learned     DOUBLE PRECISION CHECK (spice_learned BETWEEN 1 AND 4),
  spice_locked      BOOLEAN NOT NULL DEFAULT false,
  sweet_quiz        SMALLINT CHECK (sweet_quiz BETWEEN 1 AND 3),
  sweet_learned     DOUBLE PRECISION CHECK (sweet_learned BETWEEN 1 AND 3),
  sweet_locked      BOOLEAN NOT NULL DEFAULT false,
  oiliness_learned  DOUBLE PRECISION CHECK (oiliness_learned BETWEEN 1 AND 3),
  oiliness_locked   BOOLEAN NOT NULL DEFAULT false,
  budget_quiz       SMALLINT CHECK (budget_quiz BETWEEN 1 AND 4),
  budget_learned    DOUBLE PRECISION CHECK (budget_learned BETWEEN 1 AND 4),
  budget_locked     BOOLEAN NOT NULL DEFAULT false,
  quiz_done         BOOLEAN NOT NULL DEFAULT false,
  ratings_used      INTEGER NOT NULL DEFAULT 0 CHECK (ratings_used >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Favourite cuisines (M:N)
CREATE TABLE taste_profile_cuisines (
  user_id     BIGINT NOT NULL REFERENCES taste_profiles (user_id) ON DELETE CASCADE,
  cuisine_id  BIGINT NOT NULL REFERENCES cuisines (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cuisine_id)
);

-- Foods to avoid = main ingredients (M:N)
CREATE TABLE taste_profile_avoid (
  user_id             BIGINT NOT NULL REFERENCES taste_profiles (user_id) ON DELETE CASCADE,
  main_ingredient_id  BIGINT NOT NULL REFERENCES main_ingredients (id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, main_ingredient_id)
);

-- Refresh tokens only (SHA-256 hash). Rotation: replaced_by points to the new session;
-- the new session's created_at is the rotation time (used for the 10 s race window).
CREATE TABLE login_sessions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  replaced_by  BIGINT REFERENCES login_sessions (id) ON DELETE SET NULL,
  device_info  TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE login_sessions;
DROP TABLE taste_profile_avoid;
DROP TABLE taste_profile_cuisines;
DROP TABLE taste_profiles;
ALTER TABLE config_settings DROP CONSTRAINT config_settings_updated_by_fkey;
DROP TABLE users;
