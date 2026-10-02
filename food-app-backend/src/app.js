import express from 'express';
import systemRoutes from './routes/system.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(systemRoutes);
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp;
