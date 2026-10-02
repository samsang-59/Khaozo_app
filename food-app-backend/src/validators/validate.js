// Runs Zod schemas on body / query / params before the controller.
// Invalid → 400 VALIDATION_ERROR with { path, message } details.
// Valid → parsed (coerced, unknown keys stripped) values replace the originals.
import { sendFailure } from '../utils/reasons.js';

export const validate = (schemas) => (req, res, next) => {
  const details = [];
  const parsed = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) parsed[part] = result.data;
    else {
      for (const issue of result.error.issues) {
        details.push({ path: [part, ...issue.path].join('.'), message: issue.message });
      }
    }
  }
  if (details.length) return sendFailure(res, 'VALIDATION_ERROR', details);
  // Express 5: req.query is a getter, so store parsed values on req.valid
  req.valid = parsed;
  if (parsed.body) req.body = parsed.body;
  next();
};
