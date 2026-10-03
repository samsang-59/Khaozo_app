import { planDemo, photosFor, DEMO_USER_NAMES } from '../../scripts/lib/demoPlan.js';
import { unsafeReason } from '../../scripts/seed-demo.js';
import { closeConnections } from '../helpers/connections.js';

afterAll(closeConnections); // seed-demo.js imports the DB / Redis modules (they connect lazily)

const dishesByCategory = {
  Biryani: [{ id: 1, name: 'Chicken Dum Biryani', diet: 'non_veg' }, { id: 2, name: 'Veg Biryani', diet: 'veg' }],
  Curry: [{ id: 3, name: 'Chicken Curry', diet: 'non_veg' }],
  'Veg curry': [{ id: 4, name: 'Paneer Butter Masala', diet: 'veg' }],
  Drinks: [{ id: 5, name: 'Cold Coffee', diet: 'veg' }],
  Momos: [{ id: 6, name: 'Veg Steamed Momos', diet: 'veg' }, { id: 7, name: 'Chicken Steamed Momos', diet: 'non_veg' }],
};
const places = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  name: ['Biryani Blues', 'Momo Point', 'Green Leaf', 'Coffee Corner'][i % 4],
  placeType: ['restaurant', 'street_stall', 'restaurant', 'cafe'][i % 4],
  dietType: i % 4 === 2 ? 'pure_veg' : null,
  hasHours: i % 5 === 0,
  existingDishIds: i === 0 ? [1] : [],
}));
const input = { places, dishesByCategory, userIds: [101, 102, 103, 104, 105, 106, 107, 108], tagIds: { Family: 1, Friends: 2, Work: 3, 'Quick bite': 4 }, now: new Date('2026-10-01T12:00:00Z') };

describe('demo data plan', () => {
  const plan = planDemo(input);

  test('deterministic and partial (some places stay empty for the search fallback)', () => {
    expect(planDemo(input)).toEqual(plan);
    const covered = new Set(plan.menuItems.map((m) => m.placeId)).size;
    expect(covered).toBeGreaterThan(10);
    expect(covered).toBeLessThan(places.length);
  });

  test('pure-veg places only get veg dishes; existing menu dishes are not added twice', () => {
    const diet = Object.fromEntries(Object.values(dishesByCategory).flat().map((d) => [d.id, d.diet]));
    for (const m of plan.menuItems.filter((x) => places[x.placeId - 1].dietType === 'pure_veg')) expect(diet[m.standardDishId]).toBe('veg');
    expect(plan.menuItems.some((m) => m.placeId === 1 && m.standardDishId === 1)).toBe(false);
  });

  test('a name hint decides the menu ("Momo Point" sells momos)', () => {
    const momoPlaces = new Set(plan.menuItems.filter((m) => places[m.placeId - 1].name === 'Momo Point').map((m) => m.placeId));
    for (const id of momoPlaces) expect(plan.menuItems.some((m) => m.placeId === id && m.category === 'Momos')).toBe(true);
  });

  test('database rules hold: one rating per person per dish, one review per person per place', () => {
    const ratingKeys = plan.ratings.map((r) => `${r.userId}|${r.placeId}|${r.name}`);
    expect(new Set(ratingKeys).size).toBe(ratingKeys.length);
    const reviewKeys = plan.reviews.map((r) => `${r.userId}|${r.placeId}`);
    expect(new Set(reviewKeys).size).toBe(reviewKeys.length);
    const voteKeys = plan.tagVotes.map((v) => `${v.placeId}|${v.tagId}|${v.userId}`);
    expect(new Set(voteKeys).size).toBe(voteKeys.length);
    for (const r of plan.ratings) {
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(5);
      expect(r.createdAt.getTime()).toBeLessThan(input.now.getTime());
    }
  });

  test('hours only for places without any', () => {
    const withHours = new Set(places.filter((p) => p.hasHours).map((p) => p.id));
    expect(plan.hours.length).toBeGreaterThan(0);
    expect(plan.hours.some((h) => withHours.has(h.placeId))).toBe(false);
  });

  test('photos: matching dishes only, at most 2 per rating / 1 per review, every rated photo-able dish has one', () => {
    expect(photosFor({ name: 'Chicken Dum Biryani', category: 'Biryani' })[0]).toMatch(/foodish-api\.com\/images\/biryani\//);
    expect(photosFor({ name: 'Rasagola', category: 'Chhena sweets' })[0]).toMatch(/wikimedia\.org\/.*Rasgulla/);
    expect(photosFor({ name: 'Chhena Jhili', category: 'Chhena sweets' })).toEqual([]); // no believable free photo
    // meat biryani photos never go on a veg biryani — it has its own
    const meat = photosFor({ name: 'Chicken Dum Biryani', category: 'Biryani', diet: 'non_veg' });
    const veg = photosFor({ name: 'Veg Biryani', category: 'Biryani', diet: 'veg' });
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.some((u) => meat.includes(u))).toBe(false);
    expect(photosFor({ name: 'Paneer Butter Masala', category: 'Veg curry', diet: 'veg' }).length).toBeGreaterThan(0);
    expect(photosFor({ name: 'Mutton Rogan Josh', category: 'Curry' })).toEqual(['https://www.themealdb.com/images/media/meals/vvstvq1487342592.jpg']);
    const item = new Map(plan.menuItems.map((m) => [`${m.placeId}|${m.name}`, m]));
    for (const r of plan.ratings) {
      expect(r.photos.length).toBeLessThanOrEqual(2);
      const allowed = photosFor(item.get(`${r.placeId}|${r.name}`));
      for (const url of r.photos) expect(allowed).toContain(url);
    }
    for (const r of plan.reviews) expect(r.photos.length).toBeLessThanOrEqual(1);
    const dishKey = (r) => `${r.placeId}|${r.name}`;
    const photoable = new Set(plan.ratings.filter((r) => photosFor(item.get(dishKey(r))).length).map(dishKey));
    const withPhoto = new Set(plan.ratings.filter((r) => r.photos.length).map(dishKey));
    expect(withPhoto).toEqual(photoable);
  });

  test('15 demo people', () => {
    expect(DEMO_USER_NAMES).toHaveLength(15);
  });
});

describe('seed:demo safety', () => {
  const local = 'postgres://u:p@localhost:5433/food_app';
  test('runs only on a local, non-test, non-production database', () => {
    expect(unsafeReason({ nodeEnv: 'development', database: 'food_app', databaseUrl: local })).toBeNull();
    expect(unsafeReason({ nodeEnv: 'production', database: 'food_app', databaseUrl: local })).toMatch(/production/);
    expect(unsafeReason({ nodeEnv: 'development', database: 'food_app_test', databaseUrl: local })).toMatch(/test database/);
    expect(unsafeReason({ nodeEnv: 'development', database: 'railway', databaseUrl: 'postgres://u:p@db.railway.app:5432/railway' })).toMatch(/not this computer/);
  });
});
