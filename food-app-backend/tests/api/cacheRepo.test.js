import { redis } from '../../src/config/redis.js';
import * as cacheRepo from '../../src/repositories/redis/cache.repo.js';
import { closeConnections } from '../helpers/connections.js';

beforeEach(async () => {
  await redis.flushdb(); // test suite uses its own Redis DB (TEST_REDIS_URL)
});
afterAll(closeConnections);

describe('cacheRepo (Redis)', () => {
  test('setJson / getJson round-trip with a TTL', async () => {
    await cacheRepo.setJson('meta:cuisines', [{ id: 1, name: 'Odia' }], 60);
    expect(await cacheRepo.getJson('meta:cuisines')).toEqual([{ id: 1, name: 'Odia' }]);
    const ttl = await redis.ttl('meta:cuisines');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  test('getJson returns null for a missing key', async () => {
    expect(await cacheRepo.getJson('nothing:here')).toBeNull();
  });

  test('del removes keys', async () => {
    await cacheRepo.setJson('a', 1, 60);
    await cacheRepo.setJson('b', 2, 60);
    expect(await cacheRepo.del('a', 'b')).toBe(2);
    expect(await cacheRepo.del()).toBe(0);
  });

  test('delByPrefix removes only matching keys', async () => {
    await cacheRepo.setJson('meta:areas', [], 60);
    await cacheRepo.setJson('meta:tags', [], 60);
    await cacheRepo.setJson('config:all', {}, 60);
    expect(await cacheRepo.delByPrefix('meta:')).toBe(2);
    expect(await cacheRepo.getJson('config:all')).toEqual({});
  });

  test('incrementWindow counts within a window and never extends its expiry', async () => {
    const first = await cacheRepo.incrementWindow('rl:test', 60);
    expect(first.count).toBe(1);
    expect(first.ttlSeconds).toBeGreaterThan(0);

    await redis.expire('rl:test', 30); // simulate time passing
    const second = await cacheRepo.incrementWindow('rl:test', 60);
    expect(second.count).toBe(2);
    expect(second.ttlSeconds).toBeLessThanOrEqual(30);
  });
});
