import { AppRouteHandler, type AppRouteHook } from "@/types";
import {
  GetCollectionsRoute,
  GetAllBookmarks,
  GetAllBookmarksByCollectionId,
  GetBookmarksByCollectionId,
  PostAllBookmarks,
} from "./routes";
import {
  getCollectionsUseCase,
  getBookmarksUseCase,
  getAllBookmarksUseCase,
  getAllBookmarksGlobalUseCase,
  syncBookmarksUseCase,
} from "@/core/config/raindrop";

export const getCollections: AppRouteHandler<GetCollectionsRoute> = async (
  c
) => {
  const url = c.req.url;
  const result = await getCollectionsUseCase.execute(url);
  return c.json(result, 200);
};

export const getBookmarksByCollectionId: AppRouteHandler<
  GetBookmarksByCollectionId
> = async (c) => {
  const collectionId = parseInt(c.req.param("collectionId"));
  const query = c.req.valid("query");
  const page = query?.page ? parseInt(query.page) : 0;
  const perPage = query?.perpage ? parseInt(query.perpage) : 50;
  const url = c.req.url;

  const result = await getBookmarksUseCase.execute(
    collectionId,
    page,
    perPage,
    url
  );
  return c.json(result, 200);
};

export const getAllBookmarksByCollectionId: AppRouteHandler<
  GetAllBookmarksByCollectionId
> = async (c) => {
  const collectionId = parseInt(c.req.param("collectionId"));
  const url = c.req.url;
  const result = await getAllBookmarksUseCase.execute(collectionId, url);
  return c.json(result, 200);
};

export const getAllBookmarks: AppRouteHandler<GetAllBookmarks> = async (c) => {
  const url = c.req.url;
  const result = await getAllBookmarksGlobalUseCase.execute(url);
  return c.json(result, 200);
};

export const postAllBookmarks: AppRouteHandler<PostAllBookmarks> = async (
  c
) => {
  const url = c.req.url;
  await syncBookmarksUseCase.execute();
  const result = await getAllBookmarksGlobalUseCase.execute(url);
  return c.json(result, 200);
};

export const bookmarksValidationHook: AppRouteHook = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        code: 400,
        message: "Invalid bookmark request. Please check your parameters.",
      },
      400
    );
  }
};
