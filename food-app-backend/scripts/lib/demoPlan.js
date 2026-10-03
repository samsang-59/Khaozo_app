// Demo data planner (pure, no DB) — used by scripts/seed-demo.js to make a local copy look lived-in:
// menus, ratings, reviews, tag votes and opening hours for part of the imported places.
// Deterministic: the same seed and input always give the same plan.

// Small seeded PRNG (mulberry32) → same demo data on every run
export const rngFrom = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const between = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const chance = (rng, p) => rng() < p;
const sample = (rng, list, n) => {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
};

// What each kind of place usually sells (category names from the dish catalog)
const MENU_BY_TYPE = {
  restaurant: ['Biryani', 'Curry', 'Veg curry', 'Dal', 'Breads', 'Fried rice', 'Noodles', 'Chinese starters', 'Kebab & Tandoori', 'Thali', 'Rice & Pulao', 'Soup', 'Fry'],
  cafe: ['Drinks', 'Sandwich', 'Burger', 'Pizza', 'Pasta', 'Cakes & pastries'],
  bakery: ['Cakes & pastries', 'Sandwich', 'Burger', 'Drinks'],
  sweet_shop: ['Chhena sweets', 'Sweets', 'Pitha'],
  dhaba: ['Curry', 'Veg curry', 'Dal', 'Breads', 'Thali', 'Kebab & Tandoori'],
  street_stall: ['Rolls', 'Momos', 'Chaat', 'Fritters & snacks', 'Noodles'],
};
const CATEGORIES_PER_PLACE = { restaurant: 3, cafe: 3, bakery: 2, sweet_shop: 2, dhaba: 3, street_stall: 2 };

// A word in the place's name says what it sells ("Biryani Blues", "Momo Point", "Dosa Plaza")
const NAME_HINTS = [
  [/biryani|biriyani/i, ['Biryani']],
  [/momo/i, ['Momos']],
  [/dosa|idli|udupi|south/i, ['Dosa', 'Idli & Vada', 'South Indian tiffin']],
  [/pizza/i, ['Pizza']],
  [/burger/i, ['Burger']],
  [/roll/i, ['Rolls']],
  [/chin|wok|dragon|noodle/i, ['Chinese starters', 'Noodles', 'Fried rice']],
  [/tandoor|kebab|kabab|grill/i, ['Kebab & Tandoori']],
  [/chaat|chat\b/i, ['Chaat']],
  [/sweet|mishtan|mistan|rasagola/i, ['Chhena sweets']],
  [/cake|bake/i, ['Cakes & pastries']],
  [/odia|dalma|odisha|thali/i, ['Thali', 'Veg curry', 'Rice & Pulao']],
  [/coffee|chai|tea|juice|shake/i, ['Drinks']],
];

// Full-plate price range in rupees (sweets: per piece)
const PRICE = {
  Biryani: [180, 380], Curry: [180, 380], 'Veg curry': [140, 280], Dal: [100, 200], Breads: [20, 60],
  'Fried rice': [120, 240], Noodles: [100, 220], 'Chinese starters': [160, 320], 'Kebab & Tandoori': [200, 420],
  Thali: [150, 350], 'Rice & Pulao': [60, 160], Soup: [80, 160], Fry: [120, 350], Drinks: [40, 180],
  Sandwich: [80, 200], Burger: [80, 220], Pizza: [180, 450], Pasta: [160, 320], 'Cakes & pastries': [60, 180],
  'Chhena sweets': [15, 60], Sweets: [20, 80], Pitha: [20, 80], Rolls: [50, 150], Momos: [70, 180],
  Chaat: [30, 90], 'Fritters & snacks': [20, 100], Dosa: [60, 180], 'Idli & Vada': [40, 100], 'South Indian tiffin': [50, 120],
};
const SWEET_CATEGORIES = new Set(['Chhena sweets', 'Sweets', 'Pitha', 'Cakes & pastries', 'Drinks']);
const HOT_CATEGORIES = new Set(['Biryani', 'Curry', 'Chinese starters', 'Kebab & Tandoori', 'Rolls', 'Momos', 'Chaat', 'Fry', 'Noodles']);

const roundPrice = (p) => (p < 100 ? Math.round(p / 5) * 5 : Math.round(p / 10) * 10);

// Demo photos: free food photos linked (never uploaded) — Foodish (foodish-api.com), TheMealDB
// (themealdb.com) and Wikimedia Commons (CC-licensed; credits in scripts/lib/demoPhotoCredits.json).
// Hand-checked so each matches its dish; a dish with no believable free photo gets none.
const foodish = (folder, count) => Array.from({ length: count }, (_, i) => `https://foodish-api.com/images/${folder}/${folder}${i + 1}.jpg`);
const mealdb = (...ids) => ids.map((id) => `https://www.themealdb.com/images/media/meals/${id}.jpg`);
// First matching rule wins: { dish?: /name/, category?: 'Category', nonVeg?, urls }.
// nonVeg: the photos show meat / fish / egg → never used for a veg dish ("Veg Biryani", "Chilli Paneer").
export const DEMO_PHOTO_RULES = [
  { dish: /samosa/i, urls: foodish('samosa', 20) },
  { dish: /idli/i, urls: foodish('idly', 30) },
  { dish: /cold coffee/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Cold_Coffee_4.jpg/960px-Cold_Coffee_4.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Frapp%C3%A9.jpg/960px-Frapp%C3%A9.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Caf%C3%A9_frapp%C3%A9_with_vanilla_ice_cream_in_Chania_%28Crete%2C_Greece%29.jpg/960px-Caf%C3%A9_frapp%C3%A9_with_vanilla_ice_cream_in_Chania_%28Crete%2C_Greece%29.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Espresso_Coffee_Milkshake.jpg/960px-Espresso_Coffee_Milkshake.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Alamo_Drafthouse_Midnight_Espresso_Milkshake.jpg/960px-Alamo_Drafthouse_Midnight_Espresso_Milkshake.jpg'] },
  { dish: /filter coffee/i, urls: ['8/84/Indian_filter_coffee_in_Dabarah.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Foaming_filter_coffee.jpg/960px-Foaming_filter_coffee.jpg'] },
  { dish: /chai/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Masala_chai.jpg/960px-Masala_chai.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Masala_Chiya.jpg/960px-Masala_Chiya.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Milk_Masala_Tea.jpg/960px-Milk_Masala_Tea.jpg'] },
  { dish: /lassi/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Lassi_1.jpg/960px-Lassi_1.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Plain_Lassi_in_a_glass.jpg/960px-Plain_Lassi_in_a_glass.jpg'] },
  { dish: /mango shake/i, urls: [...mealdb('pjbaq11784731571'), ...['https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Mango_shake_float.jpg/960px-Mango_shake_float.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Mango_Float_Shake.jpg/960px-Mango_Float_Shake.jpg']] },
  { dish: /lime soda/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Fresh_Lime.JPG/960px-Fresh_Lime.JPG'] },
  { dish: /rasagola/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Rasgulla_preparation_for_Indian_wedding_09.jpg/960px-Rasgulla_preparation_for_Indian_wedding_09.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Rasgulla_preparation_for_Indian_wedding_12.jpg/960px-Rasgulla_preparation_for_Indian_wedding_12.jpg'] },
  { dish: /rasmalai/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Rasgulla_With_Rabdi.jpg/960px-Rasgulla_With_Rabdi.jpg'] },
  { dish: /chhena poda/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Chennapoda.jpg/960px-Chennapoda.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Chhena_Poda_-_Choudwar_-_Cuttack_2018-01-26_9970.JPG/960px-Chhena_Poda_-_Choudwar_-_Cuttack_2018-01-26_9970.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Chhena_Poda-Puri-Odisha-IMG_1323.jpg/960px-Chhena_Poda-Puri-Odisha-IMG_1323.jpg'] },
  { dish: /sandesh/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Sandesh_or_Sondesh.jpg/960px-Sandesh_or_Sondesh.jpg', '5/55/Bengali_Sandesh.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Indian_Bengali_Aam_sandesh%2C_a_type_of_popular_sweet_%28confectionery%29%2C_photographed_by_Yogabrata_Chakraborty%2C_on_May_11%2C_2023.jpg/960px-Indian_Bengali_Aam_sandesh%2C_a_type_of_popular_sweet_%28confectionery%29%2C_photographed_by_Yogabrata_Chakraborty%2C_on_May_11%2C_2023.jpg'] },
  { dish: /gulab jamun/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Gulab_Jamun_as_a_Diwali_Sweet.jpg/960px-Gulab_Jamun_as_a_Diwali_Sweet.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Gulab_jamun_%28Gibraltar%2C_November_2020%29.jpg/960px-Gulab_jamun_%28Gibraltar%2C_November_2020%29.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Two_Gulab_Jamun_in_a_plate_01.jpg/960px-Two_Gulab_Jamun_in_a_plate_01.jpg'] },
  { dish: /jalebi/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Jalebi_PK013.jpg/960px-Jalebi_PK013.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Jalebi_in_a_bowl.jpg/960px-Jalebi_in_a_bowl.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Jalebi_1.jpg/960px-Jalebi_1.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Jalebi_6.jpg/960px-Jalebi_6.jpg'] },
  { dish: /kakara pitha/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/ATTA_KAKARA.jpg/960px-ATTA_KAKARA.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Kakara_pitha_.jpg/960px-Kakara_pitha_.jpg'] },
  { dish: /manda pitha/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Manda_pitha-Puri-Odisha-IMG_0512.jpg/960px-Manda_pitha-Puri-Odisha-IMG_0512.jpg'] },
  { dish: /naan/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Butter_Naan_Flatbread_from_North_India.jpg/960px-Butter_Naan_Flatbread_from_North_India.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Butter_Naan_2.jpg/960px-Butter_Naan_2.jpg'] },
  { dish: /gupchup/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Crispy_Pani_Puri.jpg/960px-Crispy_Pani_Puri.jpg', '6/6c/Pani_puri_2.jpg'] },
  { dish: /dahibara/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Dahi_Vada%2C_a_popular_South_Indian_dish%2C_photographed_in_Avani_Riverside_Mall%2C_Howrah%2C_West_Bengal%2C_India%2C_April_16%2C_2024.jpg/960px-Dahi_Vada%2C_a_popular_South_Indian_dish%2C_photographed_in_Avani_Riverside_Mall%2C_Howrah%2C_West_Bengal%2C_India%2C_April_16%2C_2024.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Dahi_Vadas_%28Dhai_Bhalla%29.JPG/960px-Dahi_Vadas_%28Dhai_Bhalla%29.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Odia_Style_Dahi_bara_Puri_Odisha-IMG_953.jpg/960px-Odia_Style_Dahi_bara_Puri_Odisha-IMG_953.jpg'] },
  { dish: /vada pav/i, urls: ['3/36/Vada_pav_01.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Aran_Vada_Pav_Mumbai.jpg/960px-Aran_Vada_Pav_Mumbai.jpg'] },
  { dish: /matar chaat/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Samosa_chaat.jpg/960px-Samosa_chaat.jpg'] },
  { dish: /uttapam/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/Mini_Uttappam.jpg/960px-Mini_Uttappam.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Uttapam-garnishing.jpg/960px-Uttapam-garnishing.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Back_side_of_Mix_lentils_Uttapam_P_20190410_144927.jpg/960px-Back_side_of_Mix_lentils_Uttapam_P_20190410_144927.jpg'] },
  { dish: /upma/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Upma_of_Corn.jpg/960px-Upma_of_Corn.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Upma_South_India.JPG/960px-Upma_South_India.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Chhole_Upma_-_Homemade%2C_Jabalpur_-_Madhya_Pradesh_-_IMG001.jpg/960px-Chhole_Upma_-_Homemade%2C_Jabalpur_-_Madhya_Pradesh_-_IMG001.jpg'] },
  { dish: /paneer tikka/i, urls: ['a/a5/Malai_Paneer_Tikka%2C_PK_007.jpg', '8/8b/Paneer_Tikka_Shashlik_PK012.jpg'] },
  { dish: /jeera rice/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/Jeera_Rice_%28only%29.jpg/960px-Jeera_Rice_%28only%29.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Jeera_rice.jpg/960px-Jeera_rice.jpg'] },
  { dish: /veg pulao/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Jeera_Rice_India.jpg/960px-Jeera_Rice_India.jpg'] },
  { dish: /curd rice/i, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Curd_Rice.jpg/960px-Curd_Rice.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Curd_rice_in_ICH_Bhopal.jpg/960px-Curd_rice_in_ICH_Bhopal.jpg'] },
  { dish: /fish fry/i, nonVeg: true, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Bengali_Fish_fry.JPG/960px-Bengali_Fish_fry.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Bhola_machh_bhaja.jpg/960px-Bhola_machh_bhaja.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Telapia_machh_bhaja.jpg/960px-Telapia_machh_bhaja.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Punti_machh_bhaja.jpg/960px-Punti_machh_bhaja.jpg'] },
  { dish: /paneer|veg/i, category: 'Rolls', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Paneer_kathi_roll_homemade.jpg/960px-Paneer_kathi_roll_homemade.jpg'] },
  { category: 'Rolls', nonVeg: true, urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Chicken-kathi-roll-recipe.jpg/960px-Chicken-kathi-roll-recipe.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/EGG_ROLL.JPG/960px-EGG_ROLL.JPG'] },
  { dish: /odia/i, category: 'Thali', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Odia_Vegetarian_Thali.jpg/960px-Odia_Vegetarian_Thali.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Puri_22_thali_%2827553165836%29.jpg/960px-Puri_22_thali_%2827553165836%29.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Pure_desi_food_%40the_pakhala.jpg/960px-Pure_desi_food_%40the_pakhala.jpg'] },
  { category: 'Thali', urls: ['d/d9/Indian_Thali_01.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Indian_Thali_2.jpg/960px-Indian_Thali_2.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Indian_thali_with_poori_and_rice.jpg/960px-Indian_thali_with_poori_and_rice.jpg'] },
  { category: 'Noodles', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Chowmein_1.jpg/960px-Chowmein_1.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Chowmein_from_Himachal.jpg/960px-Chowmein_from_Himachal.jpg'] },
  { category: 'Chaat', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Samosa_Chat.jpg/960px-Samosa_Chat.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Samosa_Chaat.jpg/960px-Samosa_Chaat.jpg'] },
  { category: 'Sandwich', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Grilled_cheese_sandwich_with_roasted_tomato_soup.jpg/960px-Grilled_cheese_sandwich_with_roasted_tomato_soup.jpg', '8/89/Grilled_cheese_sandwich.jpg'] },
  { dish: /mutton/i, category: 'Curry', nonVeg: true, urls: mealdb('vvstvq1487342592') },
  { dish: /prawn/i, category: 'Chinese starters', nonVeg: true, urls: mealdb('1525873040') },
  { dish: /mushroom/i, category: 'Biryani', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Mushroom_Biryani.JPG/960px-Mushroom_Biryani.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Mushroom_biryani.JPG/960px-Mushroom_biryani.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Mushroom_Biriyani_2.jpg/960px-Mushroom_Biriyani_2.jpg'] },
  { dish: /paneer/i, category: 'Biryani', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Panner_Vegetable_Hyderabad_Biryani.jpg/960px-Panner_Vegetable_Hyderabad_Biryani.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Paneer_Biriyani_02.jpg/960px-Paneer_Biriyani_02.jpg'] },
  { dish: /veg/i, category: 'Biryani', urls: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/Veg_biryani_with_samosa.jpg/960px-Veg_biryani_with_samosa.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Veg_biryani_03.jpg/960px-Veg_biryani_03.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Maithil_Veg_Biryani.jpg/960px-Maithil_Veg_Biryani.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Mixed_vegetable_biryani_%28top%29.JPG/960px-Mixed_vegetable_biryani_%28top%29.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Vegetable_Biryani_IMG_001.jpg/960px-Vegetable_Biryani_IMG_001.jpg'] },
  { category: 'Biryani', nonVeg: true, urls: foodish('biryani', 30) },
  { category: 'Curry', nonVeg: true, urls: [...foodish('butter-chicken', 20), ...mealdb('wyxwsp1486979827')] },
  { category: 'Veg curry', urls: mealdb('xxpqsy1511452222', 'sywrsu1511463066') },
  { category: 'Dal', urls: mealdb('wuxrtu1483564410') },
  { category: 'Fried rice', nonVeg: true, urls: [...foodish('rice', 30), ...mealdb('wuyd2h1765655837')] },
  { category: 'Chinese starters', nonVeg: true, urls: mealdb('1525872624', 'el64dy1763483009') },
  { category: 'Kebab & Tandoori', nonVeg: true, urls: mealdb('qptpvt1487339892', '04axct1763793018', 'prjve31763486864') },
  { category: 'Soup', nonVeg: true, urls: mealdb('1529446137') },
  { category: 'Dosa', urls: foodish('dosa', 30) },
  { category: 'Idli & Vada', urls: foodish('idly', 30) },
  { category: 'Pizza', urls: foodish('pizza', 30) },
  { category: 'Pasta', urls: foodish('pasta', 30) },
  { category: 'Burger', urls: foodish('burger', 30) },
  { category: 'Cakes & pastries', urls: ['https://foodish-api.com/images/dessert/dessert1.jpg', 'https://foodish-api.com/images/dessert/dessert6.jpg'] },
  { category: 'Momos', urls: mealdb('1525876468', 'oemdp11779556068') },
];
export const photosFor = ({ name, category, diet }) =>
  DEMO_PHOTO_RULES.find((r) => (!r.dish || r.dish.test(name)) && (!r.category || r.category === category) && !(r.nonVeg && diet === 'veg'))?.urls ?? [];

const RATING_TEXT = {
  great: ['Perfectly cooked, would come back just for this.', 'Generous portion and great taste.', 'Best I have had in Bhubaneswar so far.', 'Fresh and full of flavour.', 'Worth every rupee.'],
  good: ['Pretty good, a bit oily.', 'Tasty, portion could be bigger.', 'Solid choice, nothing fancy.', 'Good but took a while to arrive.'],
  mixed: ['Was cold when it came.', 'Too salty for me.', 'Not worth the price.', 'Inconsistent — good last time, bland this time.'],
};
const REVIEW_TEXT = {
  great: ['Lovely place, staff were friendly and quick.', 'Clean, comfortable and the food was great.', 'Came with friends, had a great time.'],
  good: ['Decent place, gets busy on weekends.', 'Good food, seating is a bit cramped.', 'Nice enough, service was slow at peak time.'],
  mixed: ['Hygiene could be better.', 'Very crowded and loud, food was average.', 'Long wait and the staff seemed overwhelmed.'],
};

// Mood tags each kind of place tends to get (names from the tags table)
const MOODS_BY_TYPE = {
  restaurant: ['Family', 'Friends', 'Date', 'Celebration'],
  cafe: ['Work', 'Study', 'Date', 'Friends'],
  bakery: ['Quick bite', 'Date', 'Solo'],
  sweet_shop: ['Quick bite', 'Family'],
  dhaba: ['Late night', 'Friends', 'Budget'],
  street_stall: ['Quick bite', 'Budget', 'Late night'],
};

// day 0 = Sunday … 6; closes_at < opens_at = after midnight
const HOURS_BY_TYPE = {
  restaurant: [['11:00', '15:30'], ['19:00', '23:00']],
  cafe: [['08:00', '23:00']],
  bakery: [['08:00', '22:00']],
  sweet_shop: [['07:00', '22:00']],
  dhaba: [['11:00', '02:00']],
  street_stall: [['16:00', '23:00']],
};

const tierOf = (rng) => {
  const r = rng();
  return r < 0.3 ? 'great' : r < 0.75 ? 'good' : 'mixed';
};
const starsFor = (rng, tier) => {
  const r = rng();
  if (tier === 'great') return r < 0.65 ? 5 : r < 0.95 ? 4 : 3;
  if (tier === 'good') return r < 0.25 ? 5 : r < 0.7 ? 4 : r < 0.92 ? 3 : 2;
  return r < 0.1 ? 4 : r < 0.35 ? 3 : r < 0.75 ? 2 : 1;
};
const orderAgain = (rng, stars) => chance(rng, stars >= 5 ? 0.95 : stars === 4 ? 0.8 : stars === 3 ? 0.35 : 0.05);

// input:
//   places: [{ id, name, placeType, dietType, hasHours, existingDishIds }] (open, not deleted)
//   dishesByCategory: { categoryName: [{ id, name, diet }] } (active dishes)
//   userIds: demo user ids · tagIds: { name: id } (mood tags) · now: Date
//   coverage: share of places that get demo data (rest stay empty → search fallback still shows)
// output: { menuItems, ratings, reviews, tagVotes, hours } — plain rows, ready to insert
//   (ratings and reviews carry photos: [url] — at most 2, under the 3-per-parent limit)
export const planDemo = ({ places, dishesByCategory, userIds, tagIds, now = new Date(), seed = 42, coverage = 0.45 }) => {
  const rng = rngFrom(seed);
  const DAY = 24 * 60 * 60 * 1000;
  const someDayInLast = (days) => new Date(now.getTime() - Math.floor(rng() * days * DAY) - between(rng, 1, 600) * 60 * 1000);
  const plan = { menuItems: [], ratings: [], reviews: [], tagVotes: [], hours: [] };

  for (const place of places) {
    if (!chance(rng, coverage)) continue;
    const veg = place.dietType === 'pure_veg';
    const usual = MENU_BY_TYPE[place.placeType] ?? MENU_BY_TYPE.restaurant;
    const hinted = NAME_HINTS.filter(([re]) => re.test(place.name)).flatMap(([, cats]) => cats);
    const categories = [...new Set([...hinted, ...sample(rng, usual, CATEGORIES_PER_PLACE[place.placeType] ?? 3)])]
      .filter((c) => dishesByCategory[c]?.length);

    // Menu: 1–3 dishes per category (pure-veg places: veg dishes only)
    const placeItems = [];
    for (const category of categories) {
      const choices = dishesByCategory[category].filter((d) => (!veg || d.diet === 'veg') && !place.existingDishIds?.includes(d.id));
      for (const dish of sample(rng, choices, between(rng, 1, 3))) {
        const [lo, hi] = PRICE[category] ?? [80, 250];
        const item = { placeId: place.id, standardDishId: dish.id, name: dish.name, price: roundPrice(between(rng, lo, hi)), addedBy: pick(rng, userIds), category, diet: dish.diet };
        placeItems.push(item);
        plan.menuItems.push(item);
      }
    }

    // Ratings: 0–8 different people per dish; each dish has a quality tier.
    // About a third of ratings carry 1–2 photos (when the dish has demo photos); the first rating
    // of every such dish always gets one, so its search card, dish page and place page have a picture.
    const placePhotos = [];
    for (const item of placeItems) {
      const tier = tierOf(rng);
      const raters = sample(rng, userIds, chance(rng, 0.15) ? 0 : between(rng, 1, 8));
      const urls = photosFor(item);
      let dishHasPhoto = false;
      for (const userId of raters) {
        const photos = urls.length && (!dishHasPhoto || chance(rng, 0.35)) ? sample(rng, urls, chance(rng, 0.3) ? 2 : 1) : [];
        if (photos.length) dishHasPhoto = true;
        placePhotos.push(...photos);
        const stars = starsFor(rng, tier);
        const sweet = SWEET_CATEGORIES.has(item.category);
        plan.ratings.push({
          userId,
          placeId: item.placeId,
          name: item.name,
          stars,
          wouldOrderAgain: orderAgain(rng, stars),
          taste: Math.max(1, Math.min(5, stars + between(rng, -1, 1))),
          portion: between(rng, 2, 5),
          value: Math.max(1, Math.min(5, stars + between(rng, -1, 0))),
          spice: sweet ? null : HOT_CATEGORIES.has(item.category) ? pick(rng, ['medium', 'spicy', 'spicy', 'very_spicy']) : pick(rng, ['mild', 'mild', 'medium']),
          sweetness: sweet ? pick(rng, ['medium', 'high', 'high']) : null,
          oiliness: sweet ? null : pick(rng, ['low', 'medium', 'medium', 'high']),
          reviewText: chance(rng, 0.35) ? pick(rng, RATING_TEXT[stars >= 4 ? 'great' : stars === 3 ? 'good' : 'mixed']) : null,
          pricePaid: chance(rng, 0.5) ? item.price : null,
          createdAt: someDayInLast(60),
          photos,
        });
      }
    }

    // Place reviews: 2–6 people; facilities are facts about the place, so reviewers mostly agree
    const tier = tierOf(rng);
    const facts = {
      wifi: place.placeType === 'cafe' ? chance(rng, 0.8) : chance(rng, 0.25),
      plugPoints: place.placeType === 'cafe' ? chance(rng, 0.7) : chance(rng, 0.2),
      ac: ['street_stall', 'dhaba'].includes(place.placeType) ? false : chance(rng, 0.7),
      washroom: place.placeType !== 'street_stall' && chance(rng, 0.7),
      bikeParking: chance(rng, 0.85),
      carParking: chance(rng, 0.4),
      acceptsCash: true,
      acceptsUpi: chance(rng, 0.95),
      acceptsCard: place.placeType === 'street_stall' ? false : chance(rng, 0.6),
      noise: place.placeType === 'cafe' ? pick(rng, ['quiet', 'quiet', 'moderate']) : pick(rng, ['moderate', 'moderate', 'loud']),
    };
    const moods = sample(rng, MOODS_BY_TYPE[place.placeType] ?? MOODS_BY_TYPE.restaurant, 2);
    for (const userId of sample(rng, userIds, between(rng, 2, 6))) {
      const stars = starsFor(rng, tier);
      const near = (v) => Math.max(1, Math.min(5, v + between(rng, -1, 1)));
      plan.reviews.push({
        userId,
        placeId: place.id,
        stars,
        vibe: near(stars),
        looks: near(stars),
        serviceSpeed: near(stars),
        staff: near(stars),
        hygiene: near(stars),
        noise: facts.noise,
        crowd: pick(rng, ['empty', 'okay', 'okay', 'packed']),
        ...Object.fromEntries(Object.entries(facts).filter(([k]) => k !== 'noise').map(([k, v]) => [k, chance(rng, 0.9) ? v : !v])),
        reviewText: chance(rng, 0.45) ? pick(rng, REVIEW_TEXT[stars >= 4 ? 'great' : stars === 3 ? 'good' : 'mixed']) : null,
        createdAt: someDayInLast(60),
        // a food photo from this place's own dishes, sometimes
        photos: placePhotos.length && chance(rng, 0.3) ? [pick(rng, placePhotos)] : [],
      });
      for (const mood of moods) {
        if (tagIds[mood] && chance(rng, 0.8)) plan.tagVotes.push({ placeId: place.id, tagId: tagIds[mood], userId });
      }
    }

    // Opening hours only where none are known (closed on Mondays sometimes)
    if (!place.hasHours) {
      const closedMonday = chance(rng, 0.25);
      for (let day = 0; day <= 6; day += 1) {
        if (closedMonday && day === 1) continue;
        for (const [opensAt, closesAt] of HOURS_BY_TYPE[place.placeType] ?? HOURS_BY_TYPE.restaurant) {
          plan.hours.push({ placeId: place.id, day, opensAt, closesAt });
        }
      }
    }
  }
  return plan;
};

export const DEMO_USER_NAMES = [
  'Ananya P.', 'Rohit S.', 'Sneha M.', 'Arjun D.', 'Priya N.', 'Subham R.', 'Ipsita K.', 'Debasis B.',
  'Lipsa T.', 'Kiran J.', 'Sourav P.', 'Pooja G.', 'Abhishek M.', 'Smruti R.', 'Nikhil A.',
];
