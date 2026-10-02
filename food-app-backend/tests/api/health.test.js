import request from 'supertest';
import { createApp } from '../../src/app.js';
import { closeConnections } from '../helpers/connections.js';

const app = createApp();

afterAll(closeConnections);

describe('GET /api/v1/health', () => {
  test('200 with DB + Redis ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', db: 'ok', redis: 'ok' },
    });
  });

  test('unknown /api/v1 route → 404 in our shape', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: expect.any(String) },
    });
  });
});
