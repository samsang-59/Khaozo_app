// snake_case DB columns → camelCase JS keys (applied to every repository result).

export const snakeToCamel = (key) => key.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());

export const camelToSnake = (key) => key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);

// Converts top-level keys of one row. Values are left untouched
// (Dates, arrays, JSONB objects keep their own shape).
export const toCamel = (row) => {
  if (row === null || row === undefined) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value;
  }
  return out;
};

export const rowsToCamel = (rows) => rows.map(toCamel);
