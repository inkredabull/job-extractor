/**
 * Entry Points - Global functions exposed to Google Apps Script
 *
 * @module entry-points
 * @migration-status STUB - Needs implementation from Code-refactored.gs lines 2351-3741
 */

import { MenuService } from '../ui/MenuService';
import { AchievementService } from '../business/AchievementService';
import { Logger } from '../utils/Logger';

/**
 * Initialize services on spreadsheet open
 * Called automatically by Google Apps Script
 */
export function onOpen(_e: GoogleAppsScript.Events.SheetsOnOpen): void {
  try {
    Logger.log('Initializing Resume & Achievement System');
    MenuService.createMenu();
    // AchievementService will be used when fetch() is implemented
    void AchievementService;
  } catch (error) {
    Logger.error('Failed to initialize', error as Error);
  }
}

/**
 * Fetch and generate achievement for selected row
 * TODO: Migrate from Code-refactored.gs line 2407
 */
export function fetch(): void {
  throw new Error('Not implemented - migrate from Code-refactored.gs');
}

/**
 * Shorten achievement in selected cell
 * TODO: Migrate from Code-refactored.gs line 2455
 */
export function shorten(): void {
  throw new Error('Not implemented - migrate from Code-refactored.gs');
}

/**
 * Evaluate achievement quality
 * TODO: Migrate from Code-refactored.gs line 2475
 * Note: Renamed from 'eval' to 'evaluate' (eval is a reserved word in strict mode)
 */
export function evaluate(): void {
  throw new Error('Not implemented - migrate from Code-refactored.gs');
}

/**
 * Setup API keys for OpenRouter
 * TODO: Migrate from Code-refactored.gs line 3702
 */
export function setupAPIKeys(): void {
  throw new Error('Not implemented - migrate from Code-refactored.gs');
}

// Add other global functions as needed from original implementation
// Reference: Code-refactored.gs lines 2351-3741
