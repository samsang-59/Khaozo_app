import { sendFailure } from '../utils/reasons.js';

// Unknown /api routes → 404 in our response shape.
export const notFound = (req, res) => sendFailure(res, 'ROUTE_NOT_FOUND');

// Safety net for unexpected failures (DB down, Cloudinary timeout, bugs).
// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Malformed JSON body (thrown by express.json) is the client's fault, not ours.
  if (err?.type === 'entity.parse.failed') {
    return sendFailure(res, 'VALIDATION_ERROR', [{ path: 'body', message: 'Body is not valid JSON' }]);
  }
  if (err?.type === 'entity.too.large') {
    return sendFailure(res, 'VALIDATION_ERROR', [{ path: 'body', message: 'Body is too large' }]);
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return next(err);
  return sendFailure(res, 'INTERNAL_ERROR');
};
