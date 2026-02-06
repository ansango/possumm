import * as bookmarksHandlers from "./handlers";
import * as bookmarksRoutes from "./routes";

import { createRouter } from "@/lib/server";

const router = createRouter()
  .basePath("/api/bookmarks")
  // Register more specific routes first to avoid path conflicts
  .openapi(
    bookmarksRoutes.getCollections,
    bookmarksHandlers.getCollections,
    bookmarksHandlers.bookmarksValidationHook
  )
  .openapi(
    bookmarksRoutes.getAllBookmarks,
    bookmarksHandlers.getAllBookmarks,
    bookmarksHandlers.bookmarksValidationHook
  )
  .openapi(
    bookmarksRoutes.getAllBookmarksByCollectionId,
    bookmarksHandlers.getAllBookmarksByCollectionId,
    bookmarksHandlers.bookmarksValidationHook
  )
  .openapi(
    bookmarksRoutes.getBookmarksByCollectionId,
    bookmarksHandlers.getBookmarksByCollectionId,
    bookmarksHandlers.bookmarksValidationHook
  )
  .openapi(
    bookmarksRoutes.postAllBookmarks,
    bookmarksHandlers.postAllBookmarks,
    bookmarksHandlers.bookmarksValidationHook
  );

export default router;
