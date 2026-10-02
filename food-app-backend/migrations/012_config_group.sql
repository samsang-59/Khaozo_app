-- Up Migration
-- Group mode rules (Phase 7). group_expiry_hours already exists (migration 002).
INSERT INTO config_settings (key, value, description) VALUES
  ('group_max_members', '10', 'Most people in one live group (plan)'),
  ('group_suggestions', '5', 'How many places to suggest (plan: top 3–5)'),
  ('group_creator_grace_seconds', '60',
   'Creator offline this long (phone died) → next member by join order becomes creator');

-- Down Migration
DELETE FROM config_settings WHERE key IN ('group_max_members', 'group_suggestions', 'group_creator_grace_seconds');
