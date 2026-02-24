/**
 * Config Service - Manages configuration and API keys
 *
 * @module data/ConfigService
 */

import { CONFIG } from '../config';
import { Logger } from '../utils/Logger';
import { SheetService } from './SheetService';

/**
 * Service for managing configuration
 */
export class ConfigService {
  private sheetService: SheetService;
  private cache: Record<string, unknown>;

  /**
   * Create a new ConfigService
   * @param sheetService - Sheet service instance
   */
  constructor(sheetService: SheetService) {
    this.sheetService = sheetService;
    this.cache = {};
  }

  /**
   * Get configuration value
   * @param key - Configuration key
   * @param defaultValue - Default value if not found
   * @returns Configuration value
   */
  get(key: string, defaultValue: unknown = null): unknown {
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }

    try {
      const sheet = this.sheetService.getSheet(CONFIG.SHEETS.CONFIG);
      const data = sheet.getDataRange().getValues();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row[0] === key) {
          this.cache[key] = row[1];
          return this.cache[key];
        }
      }
    } catch (error) {
      Logger.warn(`Config key "${key}" not found, using default: ${String(defaultValue)}`);
    }

    return defaultValue;
  }

  /**
   * Set configuration value
   * @param key - Configuration key
   * @param value - Value to set
   */
  set(key: string, value: unknown): void {
    const sheet = this.sheetService.getSheet(CONFIG.SHEETS.CONFIG);
    const data = sheet.getDataRange().getValues();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row[0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        this.cache[key] = value;
        return;
      }
    }

    // If key doesn't exist, append it
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1).setValue(key);
    sheet.getRange(newRow, 2).setValue(value);
    this.cache[key] = value;
  }

  /**
   * Get API key from Script Properties
   * @param provider - Provider name (CLAUDE, GEMINI, OPENAI)
   * @returns API key
   * @throws Error if key not found
   */
  getAPIKey(provider: string): string {
    const props = PropertiesService.getScriptProperties();
    const keyName = `${provider.toUpperCase()}_API_KEY`;
    const key = props.getProperty(keyName);

    if (!key) {
      throw new Error(`API key not found for ${provider}. Run setupAPIKeys() first.`);
    }

    return key;
  }

  /**
   * Set API key in Script Properties
   * @param provider - Provider name
   * @param key - API key
   */
  setAPIKey(provider: string, key: string): void {
    const props = PropertiesService.getScriptProperties();
    const keyName = `${provider.toUpperCase()}_API_KEY`;
    props.setProperty(keyName, key);
  }

  /**
   * Get minimum wow threshold
   * @returns Minimum wow value
   */
  getMinWow(): number {
    return this.get('MIN_WOW', CONFIG.THRESHOLDS.WOW_MIN) as number;
  }

  /**
   * Get respect include flag
   * @returns Whether to respect include flag
   */
  getRespectIncludeFlag(): boolean {
    return this.get('RESPECT_INCLUDE_FLAG', true) as boolean;
  }

  /**
   * Get wow threshold
   * @returns Wow threshold
   */
  getWowThreshold(): number {
    return CONFIG.THRESHOLDS.WOW_THRESHOLD;
  }

  /**
   * Get sequence threshold
   * @returns Sequence threshold
   */
  getSequenceThreshold(): number {
    return CONFIG.THRESHOLDS.SEQUENCE_THRESHOLD;
  }
}
