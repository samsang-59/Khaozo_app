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
-- ============================================================================
-- Fail loudly (instead of silently inserting 0 dishes) if migration 002's lookup rows are missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cuisines) OR NOT EXISTS (SELECT 1 FROM dish_categories) THEN
    RAISE EXCEPTION 'Catalog lookup rows missing — run npm run migrate first';
  END IF;
END $$;

-- Source of truth: plans/08_dish_catalog.md (reviewed 2 Oct 2026). 175 dishes.
INSERT INTO standard_dishes (name, category_id, cuisine_id, main_ingredient_id, diet)
SELECT v.name, c.id, cu.id, mi.id, v.diet
FROM (VALUES
  ('Chicken Dum Biryani', 'Biryani', 'Mughlai', 'Chicken', 'non_veg'),
  ('Mutton Biryani', 'Biryani', 'Mughlai', 'Mutton', 'non_veg'),
  ('Egg Biryani', 'Biryani', 'Mughlai', 'Egg', 'egg'),
  ('Veg Biryani', 'Biryani', 'Mughlai', NULL, 'veg'),
  ('Paneer Biryani', 'Biryani', 'Mughlai', 'Paneer', 'veg'),
  ('Prawn Biryani', 'Biryani', 'Mughlai', 'Prawn', 'non_veg'),
  ('Fish Biryani', 'Biryani', 'Mughlai', 'Fish', 'non_veg'),
  ('Mushroom Biryani', 'Biryani', 'Mughlai', 'Mushroom', 'veg'),
  ('Pakhala Bhata', 'Rice & Pulao', 'Odia', NULL, 'veg'),
  ('Jeera Rice', 'Rice & Pulao', 'North Indian', NULL, 'veg'),
  ('Veg Pulao', 'Rice & Pulao', 'North Indian', NULL, 'veg'),
  ('Plain Rice', 'Rice & Pulao', 'North Indian', NULL, 'veg'),
  ('Curd Rice', 'Rice & Pulao', 'South Indian', NULL, 'veg'),
  ('Odia Veg Thali', 'Thali', 'Odia', NULL, 'veg'),
  ('Odia Fish Thali', 'Thali', 'Odia', 'Fish', 'non_veg'),
  ('North Indian Veg Thali', 'Thali', 'North Indian', NULL, 'veg'),
  ('South Indian Meals', 'Thali', 'South Indian', NULL, 'veg'),
  ('Chicken Thali', 'Thali', 'North Indian', 'Chicken', 'non_veg'),
  ('Mutton Thali', 'Thali', 'Odia', 'Mutton', 'non_veg'),
  ('Butter Chicken', 'Curry', 'North Indian', 'Chicken', 'non_veg'),
  ('Chicken Kasa', 'Curry', 'Odia', 'Chicken', 'non_veg'),
  ('Chicken Curry', 'Curry', 'North Indian', 'Chicken', 'non_veg'),
  ('Kadai Chicken', 'Curry', 'North Indian', 'Chicken', 'non_veg'),
  ('Chicken Tikka Masala', 'Curry', 'North Indian', 'Chicken', 'non_veg'),
  ('Mutton Kasa', 'Curry', 'Odia', 'Mutton', 'non_veg'),
  ('Mutton Curry', 'Curry', 'Odia', 'Mutton', 'non_veg'),
  ('Mutton Rogan Josh', 'Curry', 'North Indian', 'Mutton', 'non_veg'),
  ('Machha Besara', 'Curry', 'Odia', 'Fish', 'non_veg'),
  ('Machha Jhola', 'Curry', 'Odia', 'Fish', 'non_veg'),
  ('Fish Curry', 'Curry', 'Odia', 'Fish', 'non_veg'),
  ('Chingudi Malai Curry', 'Curry', 'Odia', 'Prawn', 'non_veg'),
  ('Prawn Curry', 'Curry', 'Odia', 'Prawn', 'non_veg'),
  ('Crab Curry', 'Curry', 'Odia', 'Crab', 'non_veg'),
  ('Egg Curry', 'Curry', 'Odia', 'Egg', 'egg'),
  ('Dalma', 'Veg curry', 'Odia', NULL, 'veg'),
  ('Santula', 'Veg curry', 'Odia', NULL, 'veg'),
  ('Chhena Tarkari', 'Veg curry', 'Odia', 'Chhena', 'veg'),
  ('Aloo Potala Rasa', 'Veg curry', 'Odia', NULL, 'veg'),
  ('Paneer Butter Masala', 'Veg curry', 'North Indian', 'Paneer', 'veg'),
  ('Kadai Paneer', 'Veg curry', 'North Indian', 'Paneer', 'veg'),
  ('Palak Paneer', 'Veg curry', 'North Indian', 'Paneer', 'veg'),
  ('Shahi Paneer', 'Veg curry', 'Mughlai', 'Paneer', 'veg'),
  ('Matar Paneer', 'Veg curry', 'North Indian', 'Paneer', 'veg'),
  ('Mushroom Masala', 'Veg curry', 'North Indian', 'Mushroom', 'veg'),
  ('Mix Veg', 'Veg curry', 'North Indian', NULL, 'veg'),
  ('Chana Masala', 'Veg curry', 'North Indian', NULL, 'veg'),
  ('Aloo Dum', 'Veg curry', 'Odia', NULL, 'veg'),
  ('Malai Kofta', 'Veg curry', 'North Indian', NULL, 'veg'),
  ('Dal Fry', 'Dal', 'North Indian', NULL, 'veg'),
  ('Dal Tadka', 'Dal', 'North Indian', NULL, 'veg'),
  ('Dal Makhani', 'Dal', 'North Indian', NULL, 'veg'),
  ('Butter Naan', 'Breads', 'North Indian', NULL, 'veg'),
  ('Garlic Naan', 'Breads', 'North Indian', NULL, 'veg'),
  ('Tandoori Roti', 'Breads', 'North Indian', NULL, 'veg'),
  ('Lachha Paratha', 'Breads', 'North Indian', NULL, 'veg'),
  ('Aloo Paratha', 'Breads', 'North Indian', NULL, 'veg'),
  ('Puri Sabji', 'Breads', 'North Indian', NULL, 'veg'),
  ('Masala Dosa', 'Dosa', 'South Indian', NULL, 'veg'),
  ('Plain Dosa', 'Dosa', 'South Indian', NULL, 'veg'),
  ('Onion Dosa', 'Dosa', 'South Indian', NULL, 'veg'),
  ('Rava Dosa', 'Dosa', 'South Indian', NULL, 'veg'),
  ('Mysore Masala Dosa', 'Dosa', 'South Indian', NULL, 'veg'),
  ('Paneer Dosa', 'Dosa', 'South Indian', 'Paneer', 'veg'),
  ('Egg Dosa', 'Dosa', 'South Indian', 'Egg', 'egg'),
  ('Idli Sambar', 'Idli & Vada', 'South Indian', NULL, 'veg'),
  ('Medu Vada', 'Idli & Vada', 'South Indian', NULL, 'veg'),
  ('Upma', 'South Indian tiffin', 'South Indian', NULL, 'veg'),
  ('Uttapam', 'South Indian tiffin', 'South Indian', NULL, 'veg'),
  ('Chicken Steamed Momos', 'Momos', 'Chinese', 'Chicken', 'non_veg'),
  ('Chicken Fried Momos', 'Momos', 'Chinese', 'Chicken', 'non_veg'),
  ('Veg Steamed Momos', 'Momos', 'Chinese', NULL, 'veg'),
  ('Veg Fried Momos', 'Momos', 'Chinese', NULL, 'veg'),
  ('Paneer Momos', 'Momos', 'Chinese', 'Paneer', 'veg'),
  ('Chicken Tandoori Momos', 'Momos', 'Chinese', 'Chicken', 'non_veg'),
  ('Pork Momos', 'Momos', 'Chinese', NULL, 'non_veg'),
  ('Veg Chowmein', 'Noodles', 'Chinese', NULL, 'veg'),
  ('Chicken Chowmein', 'Noodles', 'Chinese', 'Chicken', 'non_veg'),
  ('Egg Chowmein', 'Noodles', 'Chinese', 'Egg', 'egg'),
  ('Schezwan Noodles', 'Noodles', 'Chinese', NULL, 'veg'),
  ('Veg Fried Rice', 'Fried rice', 'Chinese', NULL, 'veg'),
  ('Chicken Fried Rice', 'Fried rice', 'Chinese', 'Chicken', 'non_veg'),
  ('Egg Fried Rice', 'Fried rice', 'Chinese', 'Egg', 'egg'),
  ('Mixed Fried Rice', 'Fried rice', 'Chinese', 'Chicken', 'non_veg'),
  ('Chilli Chicken', 'Chinese starters', 'Chinese', 'Chicken', 'non_veg'),
  ('Chicken Lollipop', 'Chinese starters', 'Chinese', 'Chicken', 'non_veg'),
  ('Chicken Manchurian', 'Chinese starters', 'Chinese', 'Chicken', 'non_veg'),
  ('Veg Manchurian', 'Chinese starters', 'Chinese', NULL, 'veg'),
  ('Chilli Paneer', 'Chinese starters', 'Chinese', 'Paneer', 'veg'),
  ('Chilli Mushroom', 'Chinese starters', 'Chinese', 'Mushroom', 'veg'),
  ('Honey Chilli Potato', 'Chinese starters', 'Chinese', NULL, 'veg'),
  ('Chilli Fish', 'Chinese starters', 'Chinese', 'Fish', 'non_veg'),
  ('Veg Manchow Soup', 'Soup', 'Chinese', NULL, 'veg'),
  ('Chicken Manchow Soup', 'Soup', 'Chinese', 'Chicken', 'non_veg'),
  ('Hot and Sour Soup', 'Soup', 'Chinese', NULL, 'veg'),
  ('Sweet Corn Soup', 'Soup', 'Chinese', NULL, 'veg'),
  ('Tomato Soup', 'Soup', 'Continental', NULL, 'veg'),
  ('Egg Roll', 'Rolls', 'Street food', 'Egg', 'egg'),
  ('Chicken Roll', 'Rolls', 'Street food', 'Chicken', 'non_veg'),
  ('Egg Chicken Roll', 'Rolls', 'Street food', 'Chicken', 'non_veg'),
  ('Paneer Roll', 'Rolls', 'Street food', 'Paneer', 'veg'),
  ('Veg Roll', 'Rolls', 'Street food', NULL, 'veg'),
  ('Mutton Roll', 'Rolls', 'Street food', 'Mutton', 'non_veg'),
  ('Dahibara Aloodum', 'Chaat', 'Street food', NULL, 'veg'),
  ('Gupchup', 'Chaat', 'Street food', NULL, 'veg'),
  ('Matar Chaat', 'Chaat', 'Street food', NULL, 'veg'),
  ('Bhel Puri', 'Chaat', 'Street food', NULL, 'veg'),
  ('Papdi Chaat', 'Chaat', 'Street food', NULL, 'veg'),
  ('Aloo Tikki Chaat', 'Chaat', 'Street food', NULL, 'veg'),
  ('Bara Ghugni', 'Fritters & snacks', 'Odia', NULL, 'veg'),
  ('Ghugni', 'Fritters & snacks', 'Odia', NULL, 'veg'),
  ('Aloo Chop', 'Fritters & snacks', 'Odia', NULL, 'veg'),
  ('Piaji', 'Fritters & snacks', 'Odia', NULL, 'veg'),
  ('Samosa', 'Fritters & snacks', 'Street food', NULL, 'veg'),
  ('Mudhi Mansa', 'Fritters & snacks', 'Odia', 'Mutton', 'non_veg'),
  ('Egg Chop', 'Fritters & snacks', 'Street food', 'Egg', 'egg'),
  ('Chicken Pakoda', 'Fritters & snacks', 'Street food', 'Chicken', 'non_veg'),
  ('Paneer Pakoda', 'Fritters & snacks', 'Street food', 'Paneer', 'veg'),
  ('Pav Bhaji', 'Fritters & snacks', 'Street food', NULL, 'veg'),
  ('Vada Pav', 'Fritters & snacks', 'Street food', NULL, 'veg'),
  ('Tandoori Chicken', 'Kebab & Tandoori', 'Mughlai', 'Chicken', 'non_veg'),
  ('Chicken Tikka', 'Kebab & Tandoori', 'Mughlai', 'Chicken', 'non_veg'),
  ('Chicken Seekh Kebab', 'Kebab & Tandoori', 'Mughlai', 'Chicken', 'non_veg'),
  ('Mutton Seekh Kebab', 'Kebab & Tandoori', 'Mughlai', 'Mutton', 'non_veg'),
  ('Reshmi Kebab', 'Kebab & Tandoori', 'Mughlai', 'Chicken', 'non_veg'),
  ('Paneer Tikka', 'Kebab & Tandoori', 'Mughlai', 'Paneer', 'veg'),
  ('Afghani Chicken', 'Kebab & Tandoori', 'Mughlai', 'Chicken', 'non_veg'),
  ('Fish Fry', 'Fry', 'Odia', 'Fish', 'non_veg'),
  ('Prawn Fry', 'Fry', 'Odia', 'Prawn', 'non_veg'),
  ('Crab Fry', 'Fry', 'Odia', 'Crab', 'non_veg'),
  ('Chicken Fry', 'Fry', 'North Indian', 'Chicken', 'non_veg'),
  ('Egg Omelette', 'Fry', 'Street food', 'Egg', 'egg'),
  ('Chakuli Pitha', 'Pitha', 'Odia', NULL, 'veg'),
  ('Arisa Pitha', 'Pitha', 'Odia', NULL, 'veg'),
  ('Manda Pitha', 'Pitha', 'Odia', NULL, 'veg'),
  ('Enduri Pitha', 'Pitha', 'Odia', NULL, 'veg'),
  ('Kakara Pitha', 'Pitha', 'Odia', NULL, 'veg'),
  ('Poda Pitha', 'Pitha', 'Odia', NULL, 'veg'),
  ('Chhena Poda', 'Chhena sweets', 'Odia', 'Chhena', 'veg'),
  ('Rasagola', 'Chhena sweets', 'Odia', 'Chhena', 'veg'),
  ('Rasabali', 'Chhena sweets', 'Odia', 'Chhena', 'veg'),
  ('Chhena Gaja', 'Chhena sweets', 'Odia', 'Chhena', 'veg'),
  ('Chhena Jhili', 'Chhena sweets', 'Odia', 'Chhena', 'veg'),
  ('Chhena Murki', 'Chhena sweets', 'Odia', 'Chhena', 'veg'),
  ('Rasmalai', 'Chhena sweets', 'Bakery & desserts', 'Chhena', 'veg'),
  ('Sandesh', 'Chhena sweets', 'Bakery & desserts', 'Chhena', 'veg'),
  ('Khira Sagara', 'Sweets', 'Odia', NULL, 'veg'),
  ('Khaja', 'Sweets', 'Odia', NULL, 'veg'),
  ('Gulab Jamun', 'Sweets', 'Bakery & desserts', NULL, 'veg'),
  ('Kheer', 'Sweets', 'North Indian', NULL, 'veg'),
  ('Jalebi', 'Sweets', 'Street food', NULL, 'veg'),
  ('Gajar Halwa', 'Sweets', 'North Indian', NULL, 'veg'),
  ('Malpua', 'Sweets', 'Odia', NULL, 'veg'),
  ('Margherita Pizza', 'Pizza', 'Fast food', NULL, 'veg'),
  ('Paneer Tikka Pizza', 'Pizza', 'Fast food', 'Paneer', 'veg'),
  ('Chicken Pizza', 'Pizza', 'Fast food', 'Chicken', 'non_veg'),
  ('Farmhouse Pizza', 'Pizza', 'Fast food', NULL, 'veg'),
  ('Veg Burger', 'Burger', 'Fast food', NULL, 'veg'),
  ('Chicken Burger', 'Burger', 'Fast food', 'Chicken', 'non_veg'),
  ('Paneer Burger', 'Burger', 'Fast food', 'Paneer', 'veg'),
  ('Veg Grilled Sandwich', 'Sandwich', 'Fast food', NULL, 'veg'),
  ('Chicken Sandwich', 'Sandwich', 'Fast food', 'Chicken', 'non_veg'),
  ('Club Sandwich', 'Sandwich', 'Fast food', 'Chicken', 'non_veg'),
  ('White Sauce Pasta', 'Pasta', 'Continental', NULL, 'veg'),
  ('Red Sauce Pasta', 'Pasta', 'Continental', NULL, 'veg'),
  ('Chicken Pasta', 'Pasta', 'Continental', 'Chicken', 'non_veg'),
  ('Chocolate Pastry', 'Cakes & pastries', 'Bakery & desserts', NULL, 'egg'),
  ('Black Forest Pastry', 'Cakes & pastries', 'Bakery & desserts', NULL, 'egg'),
  ('Brownie', 'Cakes & pastries', 'Bakery & desserts', NULL, 'egg'),
  ('Cheesecake', 'Cakes & pastries', 'Bakery & desserts', NULL, 'egg'),
  ('Masala Chai', 'Drinks', 'Beverages', NULL, 'veg'),
  ('Cold Coffee', 'Drinks', 'Beverages', NULL, 'veg'),
  ('Filter Coffee', 'Drinks', 'Beverages', NULL, 'veg'),
  ('Lassi', 'Drinks', 'Beverages', NULL, 'veg'),
  ('Mango Shake', 'Drinks', 'Beverages', NULL, 'veg'),
  ('Fresh Lime Soda', 'Drinks', 'Beverages', NULL, 'veg')
) AS v(name, category, cuisine, ingredient, diet)
JOIN dish_categories c ON c.name = v.category
JOIN cuisines cu ON cu.name = v.cuisine
LEFT JOIN main_ingredients mi ON mi.name = v.ingredient
ON CONFLICT (name) DO NOTHING;

INSERT INTO dish_aliases (alias, standard_dish_id)
SELECT v.alias, d.id
FROM (VALUES
  ('chicken biryani', 'Chicken Dum Biryani'),
  ('chkn biryani', 'Chicken Dum Biryani'),
  ('chicken biriyani', 'Chicken Dum Biryani'),
  ('dum biryani', 'Chicken Dum Biryani'),
  ('mutton biriyani', 'Mutton Biryani'),
  ('mutton dum biryani', 'Mutton Biryani'),
  ('anda biryani', 'Egg Biryani'),
  ('egg biriyani', 'Egg Biryani'),
  ('vegetable biryani', 'Veg Biryani'),
  ('veg biriyani', 'Veg Biryani'),
  ('paneer biriyani', 'Paneer Biryani'),
  ('chingudi biryani', 'Prawn Biryani'),
  ('prawn biriyani', 'Prawn Biryani'),
  ('machha biryani', 'Fish Biryani'),
  ('pakhala', 'Pakhala Bhata'),
  ('pakhal', 'Pakhala Bhata'),
  ('panta bhata', 'Pakhala Bhata'),
  ('jira rice', 'Jeera Rice'),
  ('veg pulav', 'Veg Pulao'),
  ('pulao', 'Veg Pulao'),
  ('steamed rice', 'Plain Rice'),
  ('bhata', 'Plain Rice'),
  ('dahi bhata', 'Curd Rice'),
  ('odia thali', 'Odia Veg Thali'),
  ('odia meals', 'Odia Veg Thali'),
  ('machha thali', 'Odia Fish Thali'),
  ('veg thali', 'North Indian Veg Thali'),
  ('south indian thali', 'South Indian Meals'),
  ('meals', 'South Indian Meals'),
  ('mansa thali', 'Mutton Thali'),
  ('murgh makhani', 'Butter Chicken'),
  ('chicken makhani', 'Butter Chicken'),
  ('chicken kosha', 'Chicken Kasa'),
  ('kukuda kasa', 'Chicken Kasa'),
  ('kukuda tarkari', 'Chicken Curry'),
  ('chicken kadai', 'Kadai Chicken'),
  ('karahi chicken', 'Kadai Chicken'),
  ('mutton kosha', 'Mutton Kasa'),
  ('mansa kasa', 'Mutton Kasa'),
  ('mansa tarkari', 'Mutton Curry'),
  ('mangsa tarkari', 'Mutton Curry'),
  ('rogan josh', 'Mutton Rogan Josh'),
  ('fish besara', 'Machha Besara'),
  ('macha besara', 'Machha Besara'),
  ('fish jhol', 'Machha Jhola'),
  ('macha jhola', 'Machha Jhola'),
  ('machha tarkari', 'Fish Curry'),
  ('prawn malai curry', 'Chingudi Malai Curry'),
  ('chingri malai curry', 'Chingudi Malai Curry'),
  ('chingudi tarkari', 'Prawn Curry'),
  ('kankada tarkari', 'Crab Curry'),
  ('anda tarkari', 'Egg Curry'),
  ('egg tarkari', 'Egg Curry'),
  ('chhena curry', 'Chhena Tarkari'),
  ('potala rasa', 'Aloo Potala Rasa'),
  ('parwal curry', 'Aloo Potala Rasa'),
  ('pbm', 'Paneer Butter Masala'),
  ('paneer makhani', 'Paneer Butter Masala'),
  ('paneer kadai', 'Kadai Paneer'),
  ('mutter paneer', 'Matar Paneer'),
  ('mixed vegetable', 'Mix Veg'),
  ('chole', 'Chana Masala'),
  ('aloodum', 'Aloo Dum'),
  ('alu dum', 'Aloo Dum'),
  ('dal tarka', 'Dal Tadka'),
  ('naan', 'Butter Naan'),
  ('tandoor roti', 'Tandoori Roti'),
  ('laccha paratha', 'Lachha Paratha'),
  ('alu paratha', 'Aloo Paratha'),
  ('puri bhaji', 'Puri Sabji'),
  ('poori sabzi', 'Puri Sabji'),
  ('masala dosha', 'Masala Dosa'),
  ('sada dosa', 'Plain Dosa'),
  ('rawa dosa', 'Rava Dosa'),
  ('mysore dosa', 'Mysore Masala Dosa'),
  ('idli', 'Idli Sambar'),
  ('idly', 'Idli Sambar'),
  ('vada sambar', 'Medu Vada'),
  ('wada', 'Medu Vada'),
  ('uppuma', 'Upma'),
  ('uthappam', 'Uttapam'),
  ('chicken momos', 'Chicken Steamed Momos'),
  ('chicken momo', 'Chicken Steamed Momos'),
  ('fried chicken momos', 'Chicken Fried Momos'),
  ('veg momos', 'Veg Steamed Momos'),
  ('veg momo', 'Veg Steamed Momos'),
  ('fried veg momos', 'Veg Fried Momos'),
  ('paneer momo', 'Paneer Momos'),
  ('tandoori momos', 'Chicken Tandoori Momos'),
  ('veg noodles', 'Veg Chowmein'),
  ('veg hakka noodles', 'Veg Chowmein'),
  ('chicken noodles', 'Chicken Chowmein'),
  ('chicken hakka noodles', 'Chicken Chowmein'),
  ('egg noodles', 'Egg Chowmein'),
  ('szechuan noodles', 'Schezwan Noodles'),
  ('mix fried rice', 'Mixed Fried Rice'),
  ('chili chicken', 'Chilli Chicken'),
  ('lollipop', 'Chicken Lollipop'),
  ('gobi manchurian', 'Veg Manchurian'),
  ('chili paneer', 'Chilli Paneer'),
  ('manchow soup', 'Veg Manchow Soup'),
  ('hot n sour soup', 'Hot and Sour Soup'),
  ('anda roll', 'Egg Roll'),
  ('chicken egg roll', 'Egg Chicken Roll'),
  ('dahibara', 'Dahibara Aloodum'),
  ('dahi bara aloo dum', 'Dahibara Aloodum'),
  ('dahi vada aloo dum', 'Dahibara Aloodum'),
  ('pani puri', 'Gupchup'),
  ('golgappa', 'Gupchup'),
  ('puchka', 'Gupchup'),
  ('bhel', 'Bhel Puri'),
  ('tikki chaat', 'Aloo Tikki Chaat'),
  ('bara ghuguni', 'Bara Ghugni'),
  ('vada ghugni', 'Bara Ghugni'),
  ('ghuguni', 'Ghugni'),
  ('alu chop', 'Aloo Chop'),
  ('onion pakoda', 'Piaji'),
  ('singada', 'Samosa'),
  ('mudi mansa', 'Mudhi Mansa'),
  ('dimer chop', 'Egg Chop'),
  ('chicken pakora', 'Chicken Pakoda'),
  ('paneer pakora', 'Paneer Pakoda'),
  ('wada pav', 'Vada Pav'),
  ('seekh kebab', 'Mutton Seekh Kebab'),
  ('chicken reshmi kebab', 'Reshmi Kebab'),
  ('machha bhaja', 'Fish Fry'),
  ('chingudi bhaja', 'Prawn Fry'),
  ('kankada bhaja', 'Crab Fry'),
  ('omelette', 'Egg Omelette'),
  ('omlet', 'Egg Omelette'),
  ('chakuli', 'Chakuli Pitha'),
  ('arisa', 'Arisa Pitha'),
  ('manda', 'Manda Pitha'),
  ('enduri', 'Enduri Pitha'),
  ('kakara', 'Kakara Pitha'),
  ('chenna poda', 'Chhena Poda'),
  ('chena poda', 'Chhena Poda'),
  ('rasgulla', 'Rasagola'),
  ('rosogolla', 'Rasagola'),
  ('rasagolla', 'Rasagola'),
  ('chenna gaja', 'Chhena Gaja'),
  ('chenna jhili', 'Chhena Jhili'),
  ('ras malai', 'Rasmalai'),
  ('sondesh', 'Sandesh'),
  ('gulabjamun', 'Gulab Jamun'),
  ('payasa', 'Kheer'),
  ('khiri', 'Kheer'),
  ('jilebi', 'Jalebi'),
  ('gajar ka halwa', 'Gajar Halwa'),
  ('margarita pizza', 'Margherita Pizza'),
  ('aloo tikki burger', 'Veg Burger'),
  ('grilled sandwich', 'Veg Grilled Sandwich'),
  ('veg sandwich', 'Veg Grilled Sandwich'),
  ('alfredo pasta', 'White Sauce Pasta'),
  ('arrabiata pasta', 'Red Sauce Pasta'),
  ('arrabbiata pasta', 'Red Sauce Pasta'),
  ('choco pastry', 'Chocolate Pastry'),
  ('black forest', 'Black Forest Pastry'),
  ('chocolate brownie', 'Brownie'),
  ('chai', 'Masala Chai'),
  ('cha', 'Masala Chai'),
  ('tea', 'Masala Chai'),
  ('sweet lassi', 'Lassi'),
  ('lime soda', 'Fresh Lime Soda')
) AS v(alias, dish)
JOIN standard_dishes d ON d.name = v.dish
ON CONFLICT (alias) DO NOTHING;

COMMIT;
