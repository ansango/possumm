import { EventEmitter } from "events";

interface DownloadEvent {
  id: number;
  type: string;
  data: any;
  timestamp: number;
}

export type DownloadEventType =
  | "download:enqueued"
  | "download:started"
  | "download:progress"
  | "download:completed"
  | "download:failed"
  | "download:cancelled"
  | "download:stalled"
  | "storage:low";

export interface DownloadEventData {
  downloadId: number;
  mediaId?: number | null;
  url: string;
  status?: string;
  progress?: number;
  error?: string | null;
  filePath?: string | null;
  availableGB?: number;
}

export class DownloadEventEmitter extends EventEmitter {
  private buffer: DownloadEvent[] = [];
  private nextId = 1;
  private progressThrottle: Map<number, number> = new Map();

  constructor(
    private readonly bufferSize: number = 100,
    private readonly throttleMs: number = 500
  ) {
    super();
  }

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

  emitProgress(downloadId: number, progress: number, url: string): void {
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

  clearProgressThrottle(downloadId: number): void {
    this.progressThrottle.delete(downloadId);
  }

  getEventsSince(lastId: number): DownloadEvent[] {
    return this.buffer.filter((event) => event.id > lastId);
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  clearBuffer(): void {
    this.buffer = [];
  }
}
