import { EventEmitter } from "events";

/**
 * Event structure stored in circular buffer for SSE recovery.
 */
interface DownloadEvent {
  /** Monotonically increasing event ID for ordering and gap detection */
  id: number;
  /** Event type discriminator */
  type: string;
  /** Event payload (varies by type) */
  data: any;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Supported event types for download lifecycle.
 */
export type DownloadEventType =
  | "download:enqueued"   // Download added to queue
  | "download:started"    // Download execution began
  | "download:progress"   // Progress update (throttled)
  | "download:completed"  // Download finished successfully
  | "download:failed"     // Download failed with error
  | "download:cancelled"  // Download cancelled by user
  | "download:stalled"    // Download marked as stalled (timeout)
  | "storage:low";        // Insufficient disk space detected

/**
 * Event payload structure (fields vary by event type).
 */
export interface DownloadEventData {
  downloadId?: number;
  mediaId?: number | null;
  url?: string;
  status?: string;
  progress?: number;
  error?: string | null;
  filePath?: string | null;
  availableGB?: number;
  requiredGB?: number;
}

/**
 * Event emitter for download lifecycle events with SSE support.
 * 
 * Infrastructure layer - Event-driven architecture component.
 * Extends Node.js EventEmitter with circular buffer and throttling.
 * 
 * Features:
 * - Circular buffer (default 100 events) for SSE reconnection recovery
 * - Progress throttling (default 500ms) to prevent event flooding
 * - Monotonic event IDs for ordering and gap detection
 * - Timestamp tracking for all events
 * 
 * Architecture:
 * - Use cases emit events via emitWithId/emitProgress
 * - SSE handler listens to events and streams to clients
 * - Clients can request events since last seen ID for recovery
 * 
 * Buffer is circular (FIFO) - oldest events dropped when full.
 * Progress events are throttled per-download to prevent overwhelming clients.
 * 
 * @example
 * ```typescript
 * const emitter = new DownloadEventEmitter(100, 500);
 * 
 * // Listen for download events
 * emitter.on('download:completed', (event) => {
 *   console.log(`Download ${event.data.downloadId} completed`);
 * });
 * 
 * // Emit completion event
 * emitter.emitWithId('download:completed', {
 *   downloadId: 42,
 *   url: 'https://...',
 *   status: 'completed',
 *   filePath: '/tmp/downloads/...'
 * });
 * 
 * // Emit throttled progress (500ms minimum interval per download)
 * emitter.emitProgress(42, 50); // Emitted
 * emitter.emitProgress(42, 51); // Skipped (within 500ms)
 * setTimeout(() => {
 *   emitter.emitProgress(42, 75); // Emitted (after 500ms)
 * }, 600);
 * 
 * // SSE recovery: get events since last seen
 * const missedEvents = emitter.getEventsSince(lastEventId);
 * ```
 */
export class DownloadEventEmitter extends EventEmitter {
  private buffer: DownloadEvent[] = [];
  private nextId = 1;
  private progressThrottle: Map<number, number> = new Map();

  /**
   * Creates a new DownloadEventEmitter.
   * 
   * @param bufferSize - Circular buffer size (default 100 events)
   * @param throttleMs - Progress throttle interval in milliseconds (default 500ms)
   */
  constructor(
    private readonly bufferSize: number = 100,
    private readonly throttleMs: number = 500
  ) {
    super();
  }

  /**
   * Emits an event with automatic ID assignment and buffering.
   * 
   * Flow:
   * 1. Assigns monotonic event ID
   * 2. Adds to circular buffer (drops oldest if full)
   * 3. Emits via EventEmitter for listeners
   * 
   * Event IDs are never reset - monotonically increasing.
   * Buffer is circular - oldest events dropped when capacity reached.
   * 
   * @param type - Event type discriminator
   * @param data - Event payload
   * 
   * @example
   * ```typescript
   * emitter.emitWithId('download:started', {
   *   downloadId: 42,
   *   url: 'https://music.youtube.com/watch?v=abc123',
   *   status: 'in_progress'
   * });
   * // Creates event: { id: 1, type: 'download:started', data: {...}, timestamp: 1705320000000 }
   * // Adds to buffer and emits to listeners
   * ```
   */
  emitWithId(type: DownloadEventType, data: DownloadEventData): void {
    const event: DownloadEvent = {
      id: this.nextId++,
      type,
      data,
      timestamp: Date.now(),
    };

    // Add to buffer
    this.buffer.push(event);
    
    // Remove oldest if buffer exceeds size
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Emit the event
    this.emit(type, event);
  }

  /**
   * Emits progress event with per-download throttling.
   * 
   * Throttling prevents event flooding during downloads. Each download has
   * independent throttle timer. Events within throttle window are silently dropped.
   * 
   * Flow:
   * 1. Check if last emit for this download was within throttleMs
   * 2. If yes, skip (return early)
   * 3. If no, update throttle timestamp and emit event
   * 
   * Throttle state cleared automatically on completion/failure/cancellation
   * via clearProgressThrottle.
   * 
   * @param downloadId - Download ID for throttle tracking
   * @param progress - Progress percentage (0-100)
   * @param url - Optional URL for context
   * 
   * @example
   * ```typescript
   * // Emit progress updates during download
   * emitter.emitProgress(42, 0);   // t=0ms:   Emitted (first)
   * emitter.emitProgress(42, 10);  // t=100ms: Skipped (within 500ms)
   * emitter.emitProgress(42, 25);  // t=250ms: Skipped (within 500ms)
   * emitter.emitProgress(42, 50);  // t=550ms: Emitted (after 500ms)
   * emitter.emitProgress(42, 75);  // t=800ms: Skipped (within 500ms from last emit)
   * emitter.emitProgress(42, 100); // t=1100ms: Emitted (after 500ms)
   * 
   * // Different downloads have independent throttles
   * emitter.emitProgress(42, 50);  // t=0ms: Emitted
   * emitter.emitProgress(43, 50);  // t=0ms: Emitted (different download)
   * ```
   */
  emitProgress(downloadId: number, progress: number, url?: string): void {
    const now = Date.now();
    const lastEmit = this.progressThrottle.get(downloadId);

    // Throttle: skip if last emit was less than throttleMs ago
    if (lastEmit && now - lastEmit < this.throttleMs) {
      return;
    }

    // Update throttle timestamp
    this.progressThrottle.set(downloadId, now);

    // Emit progress event
    this.emitWithId("download:progress", {
      downloadId,
      url,
      progress,
      status: "in_progress",
    });
  }

  /**
   * Clears progress throttle state for a download.
   * 
   * Called when download reaches terminal state (completed/failed/cancelled)
   * to clean up throttle tracking. Prevents memory leak from accumulating
   * throttle entries.
   * 
   * @param downloadId - Download ID to clear throttle for
   * 
   * @example
   * ```typescript
   * // After download completion
   * emitter.emitWithId('download:completed', { downloadId: 42, ... });
   * emitter.clearProgressThrottle(42);
   * // Throttle state removed, next progress (if retried) starts fresh
   * ```
   */
  clearProgressThrottle(downloadId: number): void {
    this.progressThrottle.delete(downloadId);
  }

  /**
   * Retrieves events since a given ID (SSE recovery).
   * 
   * Used when SSE client reconnects to catch up on missed events.
   * Returns events from circular buffer with ID > lastId.
   * 
   * If client's lastId is too old (outside buffer), some events will be missing.
   * Client should detect gap and potentially refresh full state.
   * 
   * @param lastId - Last event ID seen by client
   * @returns Array of events newer than lastId
   * 
   * @example
   * ```typescript
   * // Client connects and receives events 1, 2, 3
   * // Connection drops
   * // Events 4, 5, 6, 7 emitted while disconnected
   * 
   * // Client reconnects with lastId=3
   * const missed = emitter.getEventsSince(3);
   * // Returns: [event4, event5, event6, event7]
   * 
   * // If buffer was full (100 events) and events 1-3 were dropped:
   * const tooOld = emitter.getEventsSince(3);
   * // Returns: [event104, event105, ...] (gap detected by client)
   * ```
   */
  getEventsSince(lastId: number): DownloadEvent[] {
    return this.buffer.filter((event) => event.id > lastId);
  }

  /**
   * Returns current buffer size (for monitoring).
   * 
   * @returns Number of events currently in buffer
   * 
   * @example
   * ```typescript
   * const size = emitter.getBufferSize();
   * // Returns: 42 (if 42 events in buffer)
   * ```
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clears the event buffer (for testing).
   * 
   * Removes all buffered events. Does not reset nextId counter.
   * Use with caution - connected SSE clients will lose recovery ability.
   * 
   * @example
   * ```typescript
   * emitter.clearBuffer();
   * // Buffer now empty, but event IDs continue incrementing
   * ```
   */
  clearBuffer(): void {
    this.buffer = [];
  }
}
