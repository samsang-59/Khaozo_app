import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import systemRoutes from './routes/system.routes.js';
import authRoutes from './routes/auth.routes.js';
import meRoutes from './routes/me.routes.js';
import placesRoutes from './routes/places.routes.js';
import dishesRoutes from './routes/dishes.routes.js';
import metaRoutes from './routes/meta.routes.js';
import devRoutes from './routes/dev.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(systemRoutes);
  api.use(authRoutes);
  api.use(meRoutes);
  api.use(placesRoutes);
  api.use(dishesRoutes);
  api.use(metaRoutes);
  app.use('/api/v1', api);

  // Development only: tiny page with the Google button to get an ID token (Phase 2 testing)
  if (!env.isProduction) app.use(devRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp;
