-- Up Migration
-- Trust levels for weights (trust_weights: new 0.5 / normal 1.0 / trusted 2.0).
-- The plan names the levels but not their rules; these are config so admin can tune them.
INSERT INTO config_settings (key, value, description) VALUES
  ('new_account_days', '7', 'Accounts younger than this many days count as "new" (lower weight)'),
  ('trusted_min_score', '2.0', 'users.trust_score at or above this counts as "trusted" (higher weight)');

-- Down Migration
DELETE FROM config_settings WHERE key IN ('new_account_days', 'trusted_min_score');
