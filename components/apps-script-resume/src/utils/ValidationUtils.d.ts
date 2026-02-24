/**
 * Validation utility class
 *
 * @module utils/ValidationUtils
 */
export declare class ValidationUtils {
    /**
     * Validate that a sheet exists
     * @param sheetName - Name of the sheet
     * @returns True if sheet exists
     */
    static validateSheetExists(sheetName: string): boolean;
    /**
     * Validate cell value type
     * @param value - Value to validate
     * @param type - Expected type
     * @returns True if valid
     */
    static validateCellValue(value: unknown, type: string): boolean;
    /**
     * Validate API key exists
     * @param keyName - Name of the API key
     * @returns True if key exists
     */
    static validateAPIKey(keyName: string): boolean;
}
//# sourceMappingURL=ValidationUtils.d.ts.map