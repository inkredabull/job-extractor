/**
 * Validation utility class
 *
 * @module utils/ValidationUtils
 */

export class ValidationUtils {
  /**
   * Validate that a sheet exists
   * @param sheetName - Name of the sheet
   * @returns True if sheet exists
   */
  static validateSheetExists(sheetName: string): boolean {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" does not exist`);
    }
    return true;
  }

  /**
   * Validate cell value type
   * @param value - Value to validate
   * @param type - Expected type
   * @returns True if valid
   */
  static validateCellValue(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true;
    }
  }

  /**
   * Validate API key exists
   * @param keyName - Name of the API key
   * @returns True if key exists
   */
  static validateAPIKey(keyName: string): boolean {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty(keyName);
    if (!key) {
      throw new Error(`API key "${keyName}" not found. Run setupAPIKeys() first.`);
    }
    return true;
  }
}
