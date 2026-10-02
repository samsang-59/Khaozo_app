import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { notFound, errorHandler } from '../../src/middleware/errorHandler.js';

// Small app with deliberately failing routes (no DB/Redis needed).
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.get('/boom-async', async () => {
    throw new Error('async failure');
  });
  app.get('/boom-sync', () => {
    throw new Error('sync failure');
  });
  app.post('/echo', (req, res) => res.json({ success: true, data: req.body }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

describe('error middleware', () => {
  let errorSpy;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  test('async throw → 500 in our response shape (Express 5 catches it)', async () => {
    const res = await request(buildApp()).get('/boom-async');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: expect.any(String) },
    });
    expect(errorSpy).toHaveBeenCalled(); // logged
  });

  test('sync throw → 500 in our response shape', async () => {
    const res = await request(buildApp()).get('/boom-sync');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  test('error message from the bug is never sent to the client', async () => {
    const res = await request(buildApp()).get('/boom-async');
    expect(JSON.stringify(res.body)).not.toContain('async failure');
  });

  test('malformed JSON → 400 VALIDATION_ERROR', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"stars": 5,');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('unknown route → 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(buildApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
