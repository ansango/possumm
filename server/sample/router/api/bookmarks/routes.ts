import {
  CollectionIdParamSchema,
  BookmarkQuerySchema,
  BookmarksResponseSchema,
  AllBookmarksResponseSchema,
  AllBookmarksGlobalResponseSchema,
  CollectionsResponseSchema,
  AuthHeaderJWTSchema,
  AuthCookieJWTSchema,
  ErrorSchema,
} from "@/lib/schemas";
import { createRoute } from "@hono/zod-openapi";

export const getCollections = createRoute({
  method: "get",
  path: "/collections",
  tags: ["Bookmarks"],
  summary: "Get all bookmark collections",
  request: {
    headers: AuthHeaderJWTSchema,
    cookies: AuthCookieJWTSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CollectionsResponseSchema,
        },
      },
      description: "Retrieve all bookmark collections",
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type GetCollectionsRoute = typeof getCollections;

export const getBookmarksByCollectionId = createRoute({
  method: "get",
  path: "/:collectionId",
  tags: ["Bookmarks"],
  summary: "Get bookmarks by collection ID (paginated)",
  request: {
    headers: AuthHeaderJWTSchema,
    cookies: AuthCookieJWTSchema,
    params: CollectionIdParamSchema,
    query: BookmarkQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: BookmarksResponseSchema,
        },
      },
      description: "Retrieve paginated bookmarks for a collection",
    },
    400: {
      description: "Invalid request parameters",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type GetBookmarksByCollectionId = typeof getBookmarksByCollectionId;

export const getAllBookmarksByCollectionId = createRoute({
  method: "get",
  path: "/all/:collectionId",
  tags: ["Bookmarks"],
  summary: "Get all bookmarks by collection ID",
  request: {
    headers: AuthHeaderJWTSchema,
    cookies: AuthCookieJWTSchema,
    params: CollectionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AllBookmarksResponseSchema,
        },
      },
      description: "Retrieve all bookmarks for a collection",
    },
    400: {
      description: "Invalid request parameters",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type GetAllBookmarksByCollectionId =
  typeof getAllBookmarksByCollectionId;

export const getAllBookmarks = createRoute({
  method: "get",
  path: "/all",
  tags: ["Bookmarks"],
  summary: "Get all bookmarks across all collections",
  request: {
    headers: AuthHeaderJWTSchema,
    cookies: AuthCookieJWTSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AllBookmarksGlobalResponseSchema,
        },
      },
      description: "Retrieve all bookmarks",
    },
    400: {
      description: "Invalid request parameters",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type GetAllBookmarks = typeof getAllBookmarks;

export const postAllBookmarks = createRoute({
  method: "post",
  path: "/all",
  tags: ["Bookmarks"],
  summary: "Refresh all bookmarks across all collections",
  request: {
    headers: AuthHeaderJWTSchema,
    cookies: AuthCookieJWTSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AllBookmarksGlobalResponseSchema,
        },
      },
      description: "Refresh and retrieve all bookmarks",
    },
    400: {
      description: "Invalid request parameters",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type PostAllBookmarks = typeof postAllBookmarks;