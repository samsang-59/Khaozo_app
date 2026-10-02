-- Khaozo seed data — safe to run twice (no duplicates): npm run seed
-- Must-have lookup rows (tags, config, cuisines, categories, main ingredients) live in migration 002.

BEGIN;

-- ============================================================================
-- Areas: Bhubaneswar locality centre pins (one pin per area; a place's area = nearest pin)
-- Source: © OpenStreetMap contributors (ODbL) — place=* nodes via Overpass, other localities
-- via Nominatim (OSM geocoder), 2 Oct 2026. Each row notes its OSM object.
-- ============================================================================
INSERT INTO areas (name, location)
SELECT name, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
FROM (VALUES
  ('A G Colony', 20.280078, 85.830641),                    -- osm node/4615543369
  ('Acharya Vihar', 20.295590, 85.829531),                 -- osm node/4615543366
  ('Acharya Vihar Square', 20.296970, 85.833262),          -- osm node/3141329288
  ('Aiginia', 20.249632, 85.783417),                       -- osm node/2935074126
  ('Airport', 20.254730, 85.816354),                       -- osm node/5839514038
  ('Balikanthia', 20.273062, 85.911343),                   -- osm node/11398718992
  ('Baramunda', 20.273110, 85.795329),                     -- osm node/2449516669
  ('Benupur', 20.280605, 85.904546),                       -- osm node/7149834305
  ('Bhimatangi', 20.237175, 85.820984),                    -- osm way/723051236
  ('Bhingarapur', 20.268377, 85.928643),                   -- osm node/11398718981
  ('BJB Nagar', 20.256891, 85.846417),                     -- osm way/465619612
  ('Chandaka', 20.366937, 85.767238),                      -- osm node/7149873582
  ('Chandrasekharpur', 20.342172, 85.820115),              -- osm way/1360924868
  ('CRP Square', 20.284983, 85.807277),                    -- osm node/2449516666
  ('Damana', 20.328481, 85.820949),                        -- osm way/300173742
  ('Dhauli', 20.189209, 85.844003),                        -- osm node/6986325402
  ('Dumduma', 20.239603, 85.788816),                       -- osm node/7709755765
  ('Ekamra Kanan', 20.303117, 85.799496),                  -- osm way/465589976
  ('Fire Station Square', 20.279767, 85.799194),           -- osm node/3141329289
  ('Forest Park', 20.257954, 85.825295),                   -- osm way/26754524
  ('Gandamunda', 20.253748, 85.806449),                    -- osm way/1523969883
  ('Gandarpur', 20.381054, 85.856491),                     -- osm node/4156997238
  ('Gandhi Chakka', 20.289738, 85.815483),                 -- osm node/3141329290
  ('Ghatikia', 20.266985, 85.768390),                      -- osm way/236511878
  ('Gothapatna', 20.295151, 85.744029),                    -- osm way/395340472
  ('Govind Vihar', 20.282213, 85.857482),                  -- osm way/264745759
  ('Infocity', 20.342902, 85.810271),                      -- osm way/470103831
  ('Jagamara', 20.255322, 85.805978),                      -- osm way/849636689
  ('Janla', 20.220058, 85.715511),                         -- osm node/2954607829
  ('Jayadev Vihar Square', 20.295323, 85.824842),          -- osm node/3141329291
  ('Jaydev Vihar', 20.294512, 85.823666),                  -- osm way/44948784
  ('Jharpada', 20.288245, 85.862808),                      -- osm way/961917770
  ('Kalinga Nagar', 20.268043, 85.762309),                 -- osm way/236511871
  ('Kalpana Square', 20.256029, 85.840053),                -- osm node/1051794831
  ('Kalyanpur', 20.373286, 85.863894),                     -- osm node/4156997239
  ('Kapileshwar', 20.230338, 85.828709),                   -- osm node/6985771903
  ('Kedar Gouri', 20.241442, 85.841533),                   -- osm way/1377168362
  ('Khandagiri', 20.266122, 85.783224),                    -- osm node/6986325403
  ('Kharavela Nagar', 20.256429, 85.785121),               -- osm way/289325691
  ('KIIT', 20.353068, 85.820147),                          -- osm way/1109132946
  ('Kolathia Square', 20.254048, 85.785765),               -- osm node/2445343000
  ('Lewis Road', 20.220860, 85.846437),                    -- osm way/874644320
  ('Lingaraj Temple Area', 20.238369, 85.833719),          -- osm way/225868292
  ('Madhusudan Nagar', 20.283301, 85.831819),              -- osm node/4615543368
  ('Mancheswar', 20.322308, 85.844902),                    -- osm node/6166520745
  ('Master Canteen', 20.268122, 85.843785),                -- osm way/305236191
  ('Naka Gate Chowk', 20.272411, 85.783655),               -- osm node/2390712987
  ('Nandankanan', 20.393730, 85.825431),                   -- osm node/7150739818
  ('Nayapalli', 20.283191, 85.818670),                     -- osm node/2450169688
  ('New AG Colony', 20.289773, 85.830913),                 -- osm node/4615543367
  ('Old Town', 20.238301, 85.831676),                      -- osm node/6985771917
  ('Palasuni', 20.300209, 85.864755),                      -- osm way/469345705
  ('Patia', 20.360450, 85.824766),                         -- osm way/368852640
  ('Pokhariput', 20.234403, 85.813795),                    -- osm way/364407161
  ('Railway Station', 20.266777, 85.843559),               -- osm node/2669102677
  ('Rajiv Nagar', 20.250763, 85.782601),                   -- osm node/1686662993
  ('Rasulgarh', 20.299717, 85.862575),                     -- osm way/879568354
  ('Saheed Nagar', 20.288682, 85.848815),                  -- osm way/466578732
  ('Satya Nagar', 20.275261, 85.853176),                   -- osm node/6985772969
  ('Shreekhetra Vihar', 20.248316, 85.771873),             -- osm node/12299311398
  ('Sisupalgarh', 20.228818, 85.852693),                   -- osm node/6985772066
  ('TA Battalion', 20.276848, 85.823116),                  -- osm node/4613551889
  ('Tamando', 20.238362, 85.746145),                       -- osm node/7149873583
  ('Unit-1', 20.262108, 85.829792),                        -- osm node/4613711499
  ('Unit-2', 20.266844, 85.836081),                        -- osm node/4613711497
  ('Unit-3', 20.274613, 85.839313),                        -- osm node/4613711498
  ('Unit-4', 20.278818, 85.830285),                        -- osm node/4613711500
  ('Unit-5', 20.271773, 85.827074),                        -- osm node/4613711496
  ('Unit-6', 20.264830, 85.823395),                        -- osm node/4613713293
  ('Unit-7', 20.267785, 85.815315),                        -- osm node/4613713239
  ('Unit-8', 20.277062, 85.810829),                        -- osm node/4615537252
  ('Unit-9', 20.289115, 85.838307),                        -- osm node/4615538411
  ('Vani Vihar', 20.303273, 85.839744)                    -- osm way/335894565
) AS v(name, lat, lng)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Dish catalog (standard dishes + aliases)
-- Filled in from plans/08_dish_catalog_draft.md once the review is done.
-- ============================================================================

COMMIT;
