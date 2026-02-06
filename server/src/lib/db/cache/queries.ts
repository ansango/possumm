export const createTable = `
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expiry INTEGER NOT NULL
  );
`;

export const createExpiryIndex = `
  CREATE INDEX IF NOT EXISTS idx_expiry ON cache(expiry);
`;

export const insertCache = `
  INSERT OR REPLACE INTO cache (key, value, expiry) VALUES (?, ?, ?)
`;

export const findByKey = `
  SELECT value, expiry FROM cache WHERE key = ?
`;

export const findAllValid = `
  SELECT value, expiry FROM cache WHERE expiry > ?
`;

export const findExpiryByKey = `
  SELECT expiry FROM cache WHERE key = ?
`;

export const deleteByKey = `
  DELETE FROM cache WHERE key = ?
`;

export const deleteAll = `
  DELETE FROM cache
`;

export const deleteExpired = `
  DELETE FROM cache WHERE expiry < ?
`;

export const countAll = `
  SELECT COUNT(*) as count FROM cache
`;

export const countExpired = `
  SELECT COUNT(*) as count FROM cache WHERE expiry < ?
`;
