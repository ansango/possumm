import { statfs } from "fs";
import { promisify } from "util";

const statfsAsync = promisify(statfs);

export class StorageService {
  async checkAvailableSpace(path: string): Promise<number> {
    try {
      const stats = await statfsAsync(path);
      // Available space in bytes = block size * available blocks
      return stats.bavail * stats.bsize;
    } catch (error) {
      throw new Error(`Failed to check available space: ${error}`);
    }
  }

  async hasEnoughSpace(path: string, minGB: number): Promise<boolean> {
    const availableBytes = await this.checkAvailableSpace(path);
    const minBytes = minGB * 1024 * 1024 * 1024; // Convert GB to bytes
    return availableBytes >= minBytes;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }
}
