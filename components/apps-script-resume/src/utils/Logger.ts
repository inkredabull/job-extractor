/**
 * Logger utility class for consistent logging
 *
 * @module utils/Logger
 */

export class Logger {
  /**
   * Log a message (supports multiple arguments)
   * @param args - Message parts to log
   */
  static log(...args: unknown[]): void {
    console.log('[INFO]', ...args);
  }

  /**
   * Log an error with stack trace
   * @param message - Error message
   * @param error - Error object or additional context (optional)
   */
  static error(message: string, error?: Error | string): void {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  /**
   * Log a warning
   * @param message - Warning message
   */
  static warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }
}
