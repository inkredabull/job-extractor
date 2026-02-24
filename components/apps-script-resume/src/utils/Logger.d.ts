/**
 * Logger utility class for consistent logging
 *
 * @module utils/Logger
 */
export declare class Logger {
    /**
     * Log a message (supports multiple arguments)
     * @param args - Message parts to log
     */
    static log(...args: unknown[]): void;
    /**
     * Log an error with stack trace
     * @param message - Error message
     * @param error - Error object or additional context (optional)
     */
    static error(message: string, error?: Error | string): void;
    /**
     * Log a warning
     * @param message - Warning message
     */
    static warn(message: string): void;
}
//# sourceMappingURL=Logger.d.ts.map