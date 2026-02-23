/**
 * Logger utility class for consistent logging
 *
 * @module utils/Logger
 */

export class Logger {
  /**
   * Log a message
   * @param message - Message to log
   * @param level - Log level (INFO, WARN, ERROR)
   */
  static log(message: string, level: string = 'INFO'): void {
    console.log(`[${level}] ${message}`);
  }

  /**
   * Log an error with stack trace
   * @param message - Error message
   * @param error - Error object
   */
  static error(message: string, error: Error): void {
    console.error(`[ERROR] ${message}`, error);
    if (error && error.stack) {
      console.error(error.stack);
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
