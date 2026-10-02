// Lists paginate with ?limit=&cursor= (keyset pagination; the cursor is opaque to clients).
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export const encodeCursor = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

// Repos fetch limit + 1 rows; this trims the extra row and builds nextCursor from the last kept row.
export const page = (rows, limit, cursorOf) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(cursorOf(items[items.length - 1])) : null };
};
