import { osmToRecord, osmPlaceType, fsqToRecord, fsqPlaceType, insideBbox } from '../../scripts/lib/placeImport.js';

describe('OSM mapping', () => {
  test('maps amenity / shop tags to our place types', () => {
    expect(osmPlaceType({ amenity: 'restaurant' })).toBe('restaurant');
    expect(osmPlaceType({ amenity: 'fast_food' })).toBe('restaurant');
    expect(osmPlaceType({ amenity: 'cafe' })).toBe('cafe');
    expect(osmPlaceType({ shop: 'bakery' })).toBe('bakery');
    expect(osmPlaceType({ shop: 'confectionery' })).toBe('sweet_shop');
    expect(osmPlaceType({ amenity: 'restaurant', name: 'Highway Dhaba' })).toBe('dhaba');
    expect(osmPlaceType({ amenity: 'bar' })).toBeNull();
  });

  test('builds a record from a node', () => {
    const rec = osmToRecord({
      type: 'node', id: 42, lat: 20.29, lon: 85.82,
      tags: { amenity: 'restaurant', name: 'Tarini', cuisine: 'odia;chinese;pizza', 'diet:vegetarian': 'only', phone: '+91 1234' },
    });
    expect(rec).toEqual({
      source: 'osm', sourceRef: 'node/42', name: 'Tarini', lat: 20.29, lng: 85.82,
      placeType: 'restaurant', dietType: 'pure_veg', address: null, phone: '+91 1234',
      cuisines: ['Odia', 'Chinese'],
    });
  });

  test('uses the centre point of ways', () => {
    const rec = osmToRecord({ type: 'way', id: 7, center: { lat: 20.3, lon: 85.8 }, tags: { amenity: 'cafe', name: 'Cafe X' } });
    expect(rec).toMatchObject({ sourceRef: 'way/7', lat: 20.3, lng: 85.8, placeType: 'cafe' });
  });

  test('skips unnamed, unmapped or disused places', () => {
    expect(osmToRecord({ type: 'node', id: 1, lat: 20.3, lon: 85.8, tags: { amenity: 'restaurant' } })).toBeNull();
    expect(osmToRecord({ type: 'node', id: 1, lat: 20.3, lon: 85.8, tags: { amenity: 'bank', name: 'SBI' } })).toBeNull();
    expect(osmToRecord({ type: 'node', id: 1, lat: 20.3, lon: 85.8, tags: { amenity: 'cafe', name: 'Old', disused: 'yes' } })).toBeNull();
  });
});

describe('Foursquare mapping', () => {
  test('maps category labels to place types (most specific part)', () => {
    expect(fsqPlaceType(['Dining and Drinking > Restaurant > Indian Restaurant'])).toBe('restaurant');
    expect(fsqPlaceType(['Dining and Drinking > Cafe, Coffee, and Tea House > Café'])).toBe('cafe');
    expect(fsqPlaceType(['Dining and Drinking > Bakery'])).toBe('bakery');
    expect(fsqPlaceType(['Dining and Drinking > Dessert Shop'])).toBe('sweet_shop');
    expect(fsqPlaceType(['Dining and Drinking > Food Truck'])).toBe('street_stall');
    expect(fsqPlaceType(['Retail > Clothing Store'])).toBeNull();
  });

  test('builds a record and skips closed places', () => {
    const row = {
      fsq_place_id: 'abc', name: 'Dalma', latitude: 20.29, longitude: 85.84, address: 'Saheed Nagar',
      tel: null, date_closed: null,
      fsq_category_labels: ['Dining and Drinking > Restaurant > Indian Restaurant > North Indian Restaurant'],
    };
    expect(fsqToRecord(row)).toEqual({
      source: 'foursquare', sourceRef: 'abc', name: 'Dalma', lat: 20.29, lng: 85.84,
      placeType: 'restaurant', dietType: null, address: 'Saheed Nagar', phone: null, cuisines: ['North Indian'],
    });
    expect(fsqToRecord({ ...row, date_closed: '2024-01-01' })).toBeNull();
  });

  test('accepts category labels as a JSON string', () => {
    const rec = fsqToRecord({
      fsq_place_id: 'x', name: 'Cake Shop', latitude: 20.3, longitude: 85.8,
      fsq_category_labels: '["Dining and Drinking > Bakery"]',
    });
    expect(rec.placeType).toBe('bakery');
  });
});

test('insideBbox checks the Bhubaneswar box', () => {
  expect(insideBbox({ lat: 20.29, lng: 85.82 })).toBe(true);
  expect(insideBbox({ lat: 19.81, lng: 85.83 })).toBe(false); // Puri
});
