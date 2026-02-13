import { statfs } from 'fs';
import { promisify } from 'util';

const statfsAsync = promisify(statfs);

/**
 * Service for checking and managing disk storage space.
 *
 * Application layer - Service providing storage validation logic.
 * Uses system calls to check available disk space before downloads
 * to prevent failures due to insufficient storage.
 */
export class StorageService {
  /**
   * Checks available disk space at a given path.
   *
   * Uses the statfs system call to query filesystem statistics.
   * Calculates available space from block size and available blocks.
   *
   * @param path - Path to check (can be directory or file)
   * @returns Available space in bytes
   * @throws Error if statfs call fails
   *
   * @example
   * ```typescript
   * const storage = new StorageService();
   * const available = await storage.checkAvailableSpace('/tmp/downloads');
   * console.log(`Available: ${available} bytes`);
   * // Available: 10737418240 bytes (10 GB)
   * ```
   */
  async checkAvailableSpace(path: string): Promise<number> {
    try {
      const stats = await statfsAsync(path);
      // Available space in bytes = block size * available blocks
      return stats.bavail * stats.bsize;
    } catch (error) {
      throw new Error(`Failed to check available space: ${error}`);
    }
  }

  /**
   * Checks if there is enough storage space available.
   *
   * Compares available space against a minimum threshold in GB.
   * Used before starting downloads to ensure there's enough space.
   *
   * @param path - Path to check
   * @param minGB - Minimum required space in gigabytes
   * @returns True if enough space available, false otherwise
   * @throws Error if space check fails
   *
   * @example
   * ```typescript
   * const storage = new StorageService();
   *
   * // Check if at least 5GB available
   * const hasSpace = await storage.hasEnoughSpace('/tmp/downloads', 5);
   * if (hasSpace) {
   *   console.log('Sufficient space to download');
   * } else {
   *   console.log('Insufficient space');
   *   // Emit storage:low event
   * }
   * ```
   */
  async hasEnoughSpace(path: string, minGB: number): Promise<boolean> {
    const availableBytes = await this.checkAvailableSpace(path);
    const minBytes = minGB * 1024 * 1024 * 1024; // Convert GB to bytes
    return availableBytes >= minBytes;
  }

  /**
   * Formats bytes into human-readable string.
   *
   * Converts byte count to appropriate unit (B, KB, MB, GB).
   *
   * @param bytes - Number of bytes
   * @returns Formatted string with unit
   *
   * @example
   * ```typescript
   * const storage = new StorageService();
   *
   * storage.formatBytes(500);           // '500 B'
   * storage.formatBytes(1536);          // '1.50 KB'
   * storage.formatBytes(1048576);       // '1.00 MB'
   * storage.formatBytes(10737418240);   // '10.00 GB'
   * ```
   */
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
