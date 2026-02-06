export const createTableBookmarks = `
  CREATE TABLE IF NOT EXISTS bookmarks (
    _id INTEGER PRIMARY KEY,
    link TEXT NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    note TEXT,
    type TEXT NOT NULL,
    cover TEXT,
    tags TEXT NOT NULL,
    important INTEGER NOT NULL DEFAULT 0,
    removed INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL,
    collection_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    last_update TEXT NOT NULL
  )
`;

export const createTableCollections = `
  CREATE TABLE IF NOT EXISTS collections (
    _id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    public INTEGER NOT NULL DEFAULT 0,
    count INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    last_action TEXT NOT NULL,
    created TEXT NOT NULL,
    last_update TEXT NOT NULL,
    last_synced_at TEXT
  )
`;

export const createIndexBookmarksCollectionId = `
  CREATE INDEX IF NOT EXISTS idx_bookmarks_collection_id 
  ON bookmarks(collection_id)
`;

export const createIndexBookmarksCreated = `
  CREATE INDEX IF NOT EXISTS idx_bookmarks_created 
  ON bookmarks(created DESC)
`;

export const createIndexBookmarksImportant = `
  CREATE INDEX IF NOT EXISTS idx_bookmarks_important 
  ON bookmarks(important)
`;

export const createIndexCollectionsSort = `
  CREATE INDEX IF NOT EXISTS idx_collections_sort 
  ON collections(sort)
`;
