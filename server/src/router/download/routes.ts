import { createRoute } from "@hono/zod-openapi";
import {
  ErrorSchema,
  SuccessSchema,
  IdParamSchema,
  EnqueueDownloadSchema,
  EnqueueDownloadResponseSchema,
  DownloadStatusResponseSchema,
  ListDownloadsQuerySchema,
  ListDownloadsResponseSchema,
  UpdateMediaMetadataSchema,
  MediaSchema,
  MoveToDestinationResponseSchema,
} from "@/lib/schemas";

export const enqueueDownloadRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Downloads"],
  summary: "Enqueue a new download",
  request: {
    body: {
      content: {
        "application/json": {
          schema: EnqueueDownloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: EnqueueDownloadResponseSchema,
        },
      },
      description: "Descarga encolada exitosamente. Soporta tracks y álbumes de Bandcamp (bandcamp.com/track o bandcamp.com/album) y YouTube Music watch/playlist (music.youtube.com/watch o music.youtube.com/playlist). La extracción de metadata se ejecuta asíncronamente en segundo plano sin bloquear la respuesta. Emite evento SSE 'download:enqueued' con {downloadId, url, status}.",
    },
    400: {
      description: "URL inválida: solo se soportan URLs de Bandcamp tracks/albums y YouTube Music watch/playlists. Verificar formato con expresiones regulares /bandcamp\\.com\\/(track|album)\\//i y /music\\.youtube\\.com\\/(watch|playlist)/i",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    409: {
      description: "Descarga duplicada: ya existe una descarga activa (pending o in_progress) para esta URL normalizada. La normalización convierte protocol y domain a lowercase preservando path/query.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    429: {
      description: "Cola llena: máximo 10 descargas pendientes permitidas simultáneamente. Reintentar cuando descargas completen o cancelar existentes.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    507: {
      description: "Almacenamiento insuficiente: se requiere mínimo 1GB de espacio disponible en disco. Storage check verifica directorio temporal antes de iniciar descarga.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const getDownloadStatusRoute = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Downloads"],
  summary: "Get download status",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DownloadStatusResponseSchema,
        },
      },
      description: "Status de descarga recuperado exitosamente. Incluye todos los campos de DownloadItem: id, url, normalized_url, status (pending/in_progress/completed/failed/cancelled/stalled), progress (0-100), error_message (nullable), file_path (nullable), media_id (nullable), y timestamps (created_at, started_at nullable, completed_at nullable, updated_at).",
    },
    400: {
      description: "ID inválido: el parámetro id debe ser UUID v4 válido.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Descarga no encontrada: no existe download con el ID especificado.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const listDownloadsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Downloads"],
  summary: "List downloads",
  request: {
    query: ListDownloadsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ListDownloadsResponseSchema,
        },
      },
      description: "Lista de descargas recuperada exitosamente. Soporta filtros por status (pending|in_progress|completed|failed|cancelled|stalled) con query param ?status=. Ordenamiento: descargas activas (pending/in_progress) ordenadas por started_at DESC con priority, luego demás por updated_at DESC. Retorna array con objetos DownloadItem completos.",
    },
    400: {
      description: "Query param inválido: status debe ser uno de pending, in_progress, completed, failed, cancelled, stalled.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor al consultar base de datos.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const cancelDownloadRoute = createRoute({
  method: "post",
  path: "/:id/cancel",
  tags: ["Downloads"],
  summary: "Cancel a download",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessSchema,
        },
      },
      description: "Descarga cancelada exitosamente. Si status es in_progress, mata el proceso yt-dlp activo. Actualiza status a 'cancelled' y emite evento SSE 'download:cancelled'. Limpia estado de throttle de progreso.",
    },
    400: {
      description: "Estado inválido: solo se pueden cancelar descargas con status pending o in_progress. Descargas completed/failed/cancelled no son cancelables.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Descarga no encontrada: no existe download con el ID especificado.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const retryDownloadRoute = createRoute({
  method: "post",
  path: "/:id/retry",
  tags: ["Downloads"],
  summary: "Retry a failed download",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessSchema,
        },
      },
      description: "Descarga reencolada para reintento exitosamente. Resetea status a 'pending' con progress 0%, error_message null, y file_path null. Emite evento SSE 'download:enqueued'. Worker volverá a procesar desde cola.",
    },
    400: {
      description: "Estado inválido: solo se pueden reintentar descargas con status failed o cancelled. Descargas pending/in_progress/completed no son reintentables.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Descarga no encontrada: no existe download con el ID especificado.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const moveDownloadRoute = createRoute({
  method: "post",
  path: "/:id/move",
  tags: ["Downloads"],
  summary: "Move completed download to destination",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MoveToDestinationResponseSchema,
        },
      },
      description: "Archivo movido exitosamente de directorio temporal a destino final usando Bun fs.rename(). Actualiza file_path en base de datos con nueva ubicación.",
    },
    400: {
      description: "Estado inválido: solo se pueden mover descargas con status completed. Descarga debe haber finalizado exitosamente antes de mover.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Descarga no encontrada o archivo no existe en filesystem.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const getMediaDetailsRoute = createRoute({
  method: "get",
  path: "/media/:id",
  tags: ["Media"],
  summary: "Get media details",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MediaSchema,
        },
      },
      description: "Detalles de media recuperados exitosamente. Incluye todos los campos de MediaItem: id, provider (bandcamp|youtube_music), provider_id, title (required), artist/album/album_artist/year/cover_url/duration/tracks (todos nullable), y timestamps (created_at, updated_at). Campos nullable son null si yt-dlp no extrajo información.",
    },
    400: {
      description: "ID inválido: el parámetro id debe ser UUID v4 válido.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Media no encontrada: no existe media con el ID especificado.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const updateMediaMetadataRoute = createRoute({
  method: "patch",
  path: "/media/:id",
  tags: ["Media"],
  summary: "Update media metadata",
  request: {
    params: IdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateMediaMetadataSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessSchema,
        },
      },
      description: "Metadata actualizada exitosamente. Campos editables: title, artist, album, album_artist, year, cover_url, duration, tracks (todos nullable). Actualiza timestamp updated_at automáticamente.",
    },
    400: {
      description: "Campos inválidos: no se puede modificar provider o provider_id (campos inmutables que identifican fuente original). Solo se permiten actualizaciones a metadata editable.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Media no encontrada: no existe media con el ID especificado.",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type EnqueueDownloadRoute = typeof enqueueDownloadRoute;
export type GetDownloadStatusRoute = typeof getDownloadStatusRoute;
export type ListDownloadsRoute = typeof listDownloadsRoute;
export type CancelDownloadRoute = typeof cancelDownloadRoute;
export type RetryDownloadRoute = typeof retryDownloadRoute;
export type MoveDownloadRoute = typeof moveDownloadRoute;
export type GetMediaDetailsRoute = typeof getMediaDetailsRoute;
export type UpdateMediaMetadataRoute = typeof updateMediaMetadataRoute;

