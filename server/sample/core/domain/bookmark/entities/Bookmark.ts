export interface Raindrop {
  _id: number;
  link: string;
  title: string;
  excerpt: string;
  note: string;
  type: string;
  cover: string;
  tags: string[];
  important: boolean;
  removed: boolean;
  created: string;
  collection: { $ref: string; $id: number; oid: number };
  highlights: string[];
  lastUpdate: string;
  domain: string;
  collectionId: number;
}

export class Bookmark {
  constructor(
    public readonly _id: number,
    public readonly link: string,
    public readonly title: string,
    public readonly excerpt: string,
    public readonly note: string | null,
    public readonly type: string,
    public readonly cover: string | null,
    public readonly tags: string[],
    public readonly important: boolean,
    public readonly removed: boolean,
    public readonly created: string,
    public readonly collectionId: number,
    public readonly domain: string,
    public readonly lastUpdate: string
  ) {}

  static fromRaindropAPI(data: Raindrop): Bookmark {
    // Normalize cover: use HTTPS or null if empty
    const normalizedCover =
      data.cover === "" ? null : data.cover.replace(/^http?:\/\//, "https://");
    // Limit tags to first 3
    const limitedTags = data.tags.slice(0, 3);

    return new Bookmark(
      data._id,
      data.link,
      data.title,
      data.excerpt,
      data.note || null,
      data.type,
      normalizedCover,
      limitedTags,
      data.important,
      data.removed,
      data.created,
      data.collectionId,
      data.domain,
      data.lastUpdate
    );
  }

  static fromDatabase(data: {
    _id: number;
    link: string;
    title: string;
    excerpt: string;
    note: string | null;
    type: string;
    cover: string | null;
    tags: string | null;
    important: number;
    removed: number;
    created: string;
    collection_id: number;
    domain: string;
    last_update: string;
  }): Bookmark {
    const tagsArray =
      data.tags && typeof data.tags === "string" && data.tags.trim() !== ""
        ? data.tags.split(",").map((tag) => tag.trim())
        : [];
        
    return new Bookmark(
      data._id,
      data.link,
      data.title,
      data.excerpt,
      data.note,
      data.type,
      data.cover,
      tagsArray,
      data.important === 1,
      data.removed === 1,
      data.created,
      data.collection_id,
      data.domain,
      data.last_update
    );
  }

  /**
   * Create Bookmark from plain object (for cache rehydration)
   */
  static fromPlainObject(data: {
    _id: number;
    link: string;
    title: string;
    excerpt: string;
    note: string | null;
    type: string;
    cover: string | null;
    tags: string[];
    important: boolean;
    removed: boolean;
    created: string;
    collectionId: number;
    domain: string;
    lastUpdate: string;
  }): Bookmark {
    return new Bookmark(
      data._id,
      data.link,
      data.title,
      data.excerpt,
      data.note,
      data.type,
      data.cover,
      data.tags,
      data.important,
      data.removed,
      data.created,
      data.collectionId,
      data.domain,
      data.lastUpdate
    );
  }

  toJSON() {
    return {
      _id: this._id,
      link: this.link,
      title: this.title,
      excerpt: this.excerpt,
      note: this.note,
      type: this.type,
      cover: this.cover,
      tags: this.tags,
      important: this.important,
      removed: this.removed,
      created: this.created,
      collectionId: this.collectionId,
      domain: this.domain,
      lastUpdate: this.lastUpdate,
    };
  }

  /**
   * Converts tags array to comma-separated string for database storage
   */
  getTagsAsString(): string {
    return this.tags.join(", ");
  }
}
