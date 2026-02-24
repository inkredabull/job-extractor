/**
 * Logger utility class for consistent logging
 *
 * @module utils/Logger
 */
export declare class Logger {
    /**
     * Log a message
     * @param message - Message to log
     * @param level - Log level (INFO, WARN, ERROR)
     */
    static log(message: string, level?: string): void;
    /**
     * Log an error with stack trace
     * @param message - Error message
     * @param error - Error object
     */
    static error(message: string, error: Error): void;
    /**
     * Log a warning
     * @param message - Warning message
     */
    static warn(message: string): void;
}
//# sourceMappingURL=Logger.d.ts.map