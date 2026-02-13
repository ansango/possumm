# Workflows Principales

Este documento describe los flujos de operaciones principales del sistema con diagramas de secuencia y snippets de código TypeScript.

## 1. Enqueue Download (Encolar Descarga)

Flujo completo desde la solicitud del usuario hasta el encolado con metadata extraction en background.

```mermaid
sequenceDiagram
    actor Usuario
    participant API
    participant UrlNormalizer
    participant PlatformDetector
    participant Repo as DownloadRepository
    participant Events as EventEmitter
    participant BG as Background Job

    Usuario->>API: POST /downloads {url}
    API->>UrlNormalizer: normalize(url)
    UrlNormalizer-->>API: normalizedUrl

    API->>PlatformDetector: validateOrThrow(url)
    alt URL inválida
        PlatformDetector-->>API: throw Error (400)
        API-->>Usuario: 400 Invalid URL
    end
    PlatformDetector-->>API: provider

    API->>Repo: findActiveByNormalizedUrl()
    alt Duplicado activo
        Repo-->>API: download existente
        API-->>Usuario: 409 Duplicate
    end
    Repo-->>API: null

    API->>Repo: countByStatus('pending')
    alt Cola llena
        Repo-->>API: count >= 10
        API-->>Usuario: 429 Queue Full
    end
    Repo-->>API: count < 10

    API->>Repo: create(download)
    Repo-->>API: download {id, status: 'pending'}
    API->>Events: emitWithId('download:enqueued')
    API-->>Usuario: 201 {downloadId, status: 'pending'}

    Note over BG: Async (no bloquea respuesta)
    API->>BG: extractAndLinkMetadata()
    BG->>BG: MetadataExtractor.extract()
    BG->>BG: MediaRepository.findByProvider()
    BG->>BG: MediaRepository.create() si no existe
    BG->>Repo: updateMediaId()
```

### Snippet: Detección de Duplicados

```typescript
// Normalizar URL para comparación consistente
const normalizedUrl = this.urlNormalizer.normalize(url);
// "https://BANDCAMP.com/Track/Song" → "https://bandcamp.com/Track/Song"

// Buscar downloads activos con misma URL normalizada
const existingDownload = await this.downloadRepo.findActiveByNormalizedUrl(normalizedUrl);
if (existingDownload) {
  throw new Error('A download for this URL is already pending or in progress');
}
```

### Snippet: Validación Límite Cola

```typescript
// Verificar límite máximo de descargas pendientes
const pendingCount = await this.downloadRepo.countByStatus('pending');
if (pendingCount >= this.maxPending) {
  // default: 10
  throw new Error(`Maximum ${this.maxPending} pending downloads reached`);
}
```

## 2. Process Download (Procesar Descarga)

Worker procesa descargas de la cola FIFO ejecutando yt-dlp con tracking de progreso.

```mermaid
sequenceDiagram
    participant Worker
    participant UseCase as ProcessDownload
    participant Storage as StorageService
    participant Repo as DownloadRepository
    participant Executor as DownloadExecutor
    participant Events as EventEmitter

    Worker->>Repo: findNextPending() FIFO
    Repo-->>Worker: download {id, url, status: 'pending'}
    Worker->>UseCase: execute(downloadId)

    UseCase->>Repo: findById(downloadId)
    UseCase->>Storage: hasEnoughSpace(tempDir, minGB)
    alt Espacio insuficiente
        Storage-->>UseCase: false
        UseCase->>Repo: updateStatus('failed', error)
        UseCase->>Events: emit('storage:low')
        UseCase-->>Worker: throw 507 Insufficient Storage
    end
    Storage-->>UseCase: true

    UseCase->>Repo: updateStatus('in_progress', 0%)
    UseCase->>Repo: updateProcessId(downloadId, processId)
    UseCase->>Events: emit('download:started')

    UseCase->>Executor: execute(url, provider, onProgress)

    loop Durante descarga
        Executor->>Executor: parse stderr progress
        Executor->>UseCase: onProgress(progress)
        UseCase->>Repo: updateStatus('in_progress', progress%)
        UseCase->>Events: emitProgress(downloadId, progress)
        Note over Events: Throttled 500ms
    end

    alt Éxito
        Executor-->>UseCase: {filePath, processId}
        UseCase->>Repo: updateStatus('completed', 100%, filePath)
        UseCase->>Events: emit('download:completed')
    else Error
        Executor-->>UseCase: throw Error
        UseCase->>Repo: updateStatus('failed', error)
        UseCase->>Events: emit('download:failed')
    end
```

### Snippet: Parsing Progreso yt-dlp

```typescript
// Regex para extraer porcentaje de stderr yt-dlp
const progressRegex = /\[download\]\s+(\d+\.?\d*)%/;

const lines = stderrText.split('\n');
for (const line of lines) {
  const match = progressRegex.exec(line);
  if (match) {
    const progress = Math.min(99, Math.floor(parseFloat(match[1])));
    await onProgress(progress); // Cap a 99% durante descarga
  }
}
// Reportar 100% solo en exit exitoso
```

### Snippet: Query Timeout Stalled

```typescript
// Query SQL para downloads estancados
const query = `
  SELECT * FROM downloads 
  WHERE status = 'in_progress' 
    AND started_at < datetime('now', '-? minutes')
`;
// Parámetro: timeoutMinutes (default 60)
```

## 3. Cancel Download (Cancelar Descarga)

Usuario cancela descarga activa, matando proceso yt-dlp si está ejecutándose.

```mermaid
sequenceDiagram
    actor Usuario
    participant API
    participant UseCase as CancelDownload
    participant Repo as DownloadRepository
    participant Executor as DownloadExecutor
    participant Events as EventEmitter

    Usuario->>API: POST /downloads/:id/cancel
    API->>UseCase: execute(downloadId)

    UseCase->>Repo: findById(downloadId)
    alt Download no encontrado
        Repo-->>UseCase: null
        UseCase-->>API: throw 404 Not Found
    end
    Repo-->>UseCase: download

    alt Estado no cancelable
        Note over UseCase: status = 'completed'|'failed'
        UseCase-->>API: throw 400 Cannot Cancel
        API-->>Usuario: 400 Invalid Status
    end

    alt Estado in_progress
        UseCase->>Executor: cancel(processId)
        Executor->>Executor: process.kill()
        Executor-->>UseCase: proceso terminado
    end

    UseCase->>Repo: updateStatus('cancelled', 'Cancelled by user')
    UseCase->>Events: emitWithId('download:cancelled')
    UseCase->>Events: clearProgressThrottle(downloadId)
    UseCase-->>API: success
    API-->>Usuario: 200 OK
```

### Snippet: Cancelación de Proceso

```typescript
// Verificar estado cancelable
if (download.status !== 'pending' && download.status !== 'in_progress') {
  throw new Error(`Cannot cancel download with status: ${download.status}`);
}

// Matar proceso yt-dlp si está en ejecución
if (download.processId && download.status === 'in_progress') {
  this.downloadExecutor.cancel(download.processId);
  // Envía SIGKILL al proceso
}

// Limpiar estado throttle de eventos de progreso
this.eventEmitter.clearProgressThrottle(downloadId);
```

## 4. Retry Download (Reintentar Descarga)

Usuario reintenta descarga fallida o cancelada, resetando a estado pending.

```mermaid
sequenceDiagram
    actor Usuario
    participant API
    participant UseCase as RetryDownload
    participant Repo as DownloadRepository
    participant Events as EventEmitter

    Usuario->>API: POST /downloads/:id/retry
    API->>UseCase: execute(downloadId)

    UseCase->>Repo: findById(downloadId)
    alt Download no encontrado
        Repo-->>UseCase: null
        UseCase-->>API: throw 404 Not Found
    end
    Repo-->>UseCase: download {status: 'failed'|'cancelled'}

    alt Estado no reintentable
        Note over UseCase: status != 'failed'|'cancelled'
        UseCase-->>API: throw 400 Cannot Retry
        API-->>Usuario: 400 Invalid Status
    end

    UseCase->>Repo: updateStatus('pending', 0%, null, null)
    Note over Repo: Reset progress, error, filePath
    UseCase->>Events: emitWithId('download:enqueued')
    UseCase-->>API: success
    API-->>Usuario: 200 OK

    Note over Repo: Worker poll volverá a procesar
```

### Snippet: Reset a Pending

```typescript
// Validar estado reintentable
if (download.status !== 'failed' && download.status !== 'cancelled') {
  throw new Error(`Cannot retry download with status: ${download.status}`);
}

// Reset completo a estado inicial
await this.downloadRepo.updateStatus(
  downloadId,
  'pending', // nuevo status
  0, // progress reset
  null, // clear error_message
  null // clear file_path
);

// Re-emitir evento de encolado
this.eventEmitter.emitWithId('download:enqueued', {
  downloadId,
  url: download.url,
  status: 'pending'
});
```

## 5. Cleanup Orphaned Files (Limpieza Archivos Huérfanos)

Scheduler semanal elimina downloads antiguos y media sin referencias.

```mermaid
sequenceDiagram
    participant Scheduler
    participant UseCase as CleanupOrphanedFiles
    participant DownloadRepo
    participant MediaRepo
    participant FS as Filesystem

    Scheduler->>UseCase: execute() cada 7 días
    UseCase->>DownloadRepo: findOldCompleted(retentionDays)
    DownloadRepo-->>UseCase: downloads antiguos

    loop Para cada download antiguo
        UseCase->>FS: exists(filePath)?
        alt Archivo existe
            FS-->>UseCase: true
            UseCase->>FS: rm -rf filePath
        end
        UseCase->>DownloadRepo: delete(downloadId)
    end

    UseCase->>MediaRepo: findAll()
    MediaRepo-->>UseCase: todos los media

    loop Para cada media
        UseCase->>DownloadRepo: findAll() con mediaId
        alt Sin downloads asociados
            DownloadRepo-->>UseCase: []
            UseCase->>MediaRepo: delete(mediaId)
        end
    end

    UseCase-->>Scheduler: {downloadsDeleted, mediaDeleted, filesDeleted}
```

### Snippet: Limpieza con Manejo de Errores

```typescript
// Buscar downloads completados/fallidos antiguos
const oldDownloads = await this.downloadRepo.findOldCompleted(this.retentionDays);

for (const download of oldDownloads) {
  try {
    // Eliminar archivo si existe
    if (download.filePath && (await exists(download.filePath))) {
      await rm(download.filePath, { recursive: true, force: true });
      filesDeleted++;
    }

    // Eliminar registro DB
    await this.downloadRepo.delete(download.id);
    downloadsDeleted++;
  } catch (error) {
    // Log error pero continuar limpieza
    this.logger.warn({ error, downloadId: download.id }, 'Failed to cleanup');
  }
}
```

## 6. Mark Stalled Downloads (Marcar Descargas Estancadas)

Scheduler cada 5min detecta descargas estancadas y las marca como fallidas.

```mermaid
sequenceDiagram
    participant Scheduler
    participant UseCase as MarkStalledDownloads
    participant Repo as DownloadRepository
    participant Events as EventEmitter

    Scheduler->>UseCase: execute() cada 5 min
    UseCase->>Repo: findStalledInProgress(timeoutMinutes)
    Note over Repo: WHERE status='in_progress'<br/>AND started_at < now - timeout
    Repo-->>UseCase: downloads estancados

    loop Para cada download estancado
        UseCase->>Repo: updateStatus('failed', progress, 'Stalled...')
        UseCase->>Events: emitWithId('download:stalled')
        UseCase->>Events: clearProgressThrottle(downloadId)
    end

    UseCase-->>Scheduler: count de downloads marcados
```

### Snippet: Query Temporal Stalled

```typescript
// Método repositorio para encontrar estancados
async findStalledInProgress(timeoutMinutes: number): Promise<DownloadItem[]> {
  const query = `
    SELECT * FROM downloads
    WHERE status = 'in_progress'
      AND started_at < datetime('now', '-' || ? || ' minutes')
  `;
  const rows = this.db.query(query).all(timeoutMinutes);
  return rows.map(DownloadItem.fromDatabase);
}

// Uso en use case
const stalledDownloads = await this.downloadRepo.findStalledInProgress(60);
// Encuentra downloads en progreso iniciados hace más de 60 minutos
```

## Eventos Emitidos por Workflow

| Workflow             | Eventos Emitidos                                                                                            | Payload                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| EnqueueDownload      | `download:enqueued`                                                                                         | `{downloadId, url, status}`                                                                                                        |
| ProcessDownload      | `download:started`<br/>`download:progress`<br/>`download:completed`<br/>`download:failed`<br/>`storage:low` | `{downloadId}`<br/>`{downloadId, progress}`<br/>`{downloadId, filePath}`<br/>`{downloadId, error}`<br/>`{availableGB, requiredGB}` |
| CancelDownload       | `download:cancelled`                                                                                        | `{downloadId, url, status}`                                                                                                        |
| RetryDownload        | `download:enqueued`                                                                                         | `{downloadId, url, status}`                                                                                                        |
| MarkStalledDownloads | `download:stalled`                                                                                          | `{downloadId, url, status, error}`                                                                                                 |

Ver [download-logs-api.md](download-logs-api.md) para detalles del sistema de logs.

## Recomendaciones

⚠️ **No reintentar descargas automáticamente**: Las descargas fallidas requieren acción explícita del usuario vía `RetryDownload`. Esto previene loops infinitos con URLs problemáticas y permite al usuario investigar el error antes de reintentar. Ver [CancelDownload.ts](../src/core/application/download/use-cases/CancelDownload.ts) para manejo de errores.

💡 **Limitar progress al 99% hasta exit del proceso**: Durante la ejecución de yt-dlp, el progreso se reporta con cap de 99%. Solo al exit exitoso (code 0) se reporta 100%. Esto evita falsos positivos donde el progreso llegó a 100% pero el proceso falló en post-processing. Ver [DownloadExecutor.ts](../src/core/application/download/services/DownloadExecutor.ts#L150-165).

✅ **Ejecutar cleanup scheduler en horarios baja carga**: El scheduler de limpieza (`CleanupOrphanedFiles`) se recomienda ejecutar entre 2-4am para minimizar impacto en operaciones de usuario. Operaciones de filesystem (rm -rf) pueden ser costosas con muchos archivos.

🔧 **Timeout 60min configurable via env var**: El timeout de detección de descargas estancadas es configurable con `DOWNLOAD_TIMEOUT_MINUTES` (default 60). Ajustar según tamaño típico de álbumes en tu caso de uso. Álbumes grandes de Bandcamp pueden necesitar más tiempo.

---

**Ver también**:

- [Services](services.md#downloadexecutor) - Detalles de ejecución yt-dlp
- [Domain Model](domain-model.md) - Máquina de estados Download
- [Download Logs API](download-logs-api.md) - Sistema de logs persistentes con REST API
