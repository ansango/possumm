export interface RaindropCollection {
  _id: number;
  title: string;
  description: string;
  public: boolean;
  count: number;
  sort: number;
  lastAction: string;
  created: string;
  lastUpdate: string;
}

export class Collection {
  constructor(
    public readonly _id: number,
    public readonly title: string,
    public readonly description: string | null,
    public readonly isPublic: boolean,
    public readonly count: number,
    public readonly sort: number,
    public readonly lastAction: string,
    public readonly created: string,
    public readonly lastUpdate: string,
    public readonly lastSyncedAt: string | null = null
  ) {}

  static fromRaindropAPI(data: RaindropCollection): Collection {
    return new Collection(
      data._id,
      data.title,
      data.description || null,
      data.public,
      data.count,
      data.sort,
      data.lastAction,
      data.created,
      data.lastUpdate
    );
  }

  static fromDatabase(data: {
    _id: number;
    title: string;
    description: string | null;
    public: number;
    count: number;
    sort: number;
    last_action: string;
    created: string;
    last_update: string;
    last_synced_at: string | null;
  }): Collection {
    return new Collection(
      data._id,
      data.title,
      data.description,
      data.public === 1, // Map database 'public' to isPublic
      data.count,
      data.sort,
      data.last_action,
      data.created,
      data.last_update,
      data.last_synced_at
    );
  }

  /**
   * Create Collection from plain object (for cache rehydration)
   */
  static fromPlainObject(data: {
    _id: number;
    title: string;
    description: string | null;
    isPublic: boolean;
    count: number;
    sort: number;
    lastAction: string;
    created: string;
    lastUpdate: string;
    lastSyncedAt: string | null;
  }): Collection {
    return new Collection(
      data._id,
      data.title,
      data.description,
      data.isPublic,
      data.count,
      data.sort,
      data.lastAction,
      data.created,
      data.lastUpdate,
      data.lastSyncedAt
    );
  }

  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      description: this.description,
      isPublic: this.isPublic,
      count: this.count,
      sort: this.sort,
      lastAction: this.lastAction,
      created: this.created,
      lastUpdate: this.lastUpdate,
      lastSyncedAt: this.lastSyncedAt,
    };
  }
}
