import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import systemRoutes from './routes/system.routes.js';
import authRoutes from './routes/auth.routes.js';
import meRoutes from './routes/me.routes.js';
import placesRoutes from './routes/places.routes.js';
import dishesRoutes from './routes/dishes.routes.js';
import metaRoutes from './routes/meta.routes.js';
import menuItemsRoutes from './routes/menuItems.routes.js';
import ratingsRoutes from './routes/ratings.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import photosRoutes from './routes/photos.routes.js';
import journalRoutes from './routes/journal.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import notesRoutes from './routes/notes.routes.js';
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
  api.use(menuItemsRoutes);
  api.use(ratingsRoutes);
  api.use(reviewsRoutes);
  api.use(photosRoutes);
  api.use(journalRoutes);
  api.use(wishlistRoutes);
  api.use(notesRoutes);
  app.use('/api/v1', api);

  // Development only: tiny page with the Google button to get an ID token (Phase 2 testing)
  if (!env.isProduction) app.use(devRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp;
