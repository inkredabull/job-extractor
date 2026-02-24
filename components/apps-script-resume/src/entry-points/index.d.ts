/**
 * Entry Points - Global functions exposed to Google Apps Script
 *
 * @module entry-points
 * @migration-status STUB - Needs implementation from Code-refactored.gs lines 2351-3741
 */
/**
 * Initialize services on spreadsheet open
 * Called automatically by Google Apps Script
 */
export declare function onOpen(_e: GoogleAppsScript.Events.SheetsOnOpen): void;
/**
 * Fetch and generate achievement for selected row
 * TODO: Migrate from Code-refactored.gs line 2407
 */
export declare function fetch(): void;
/**
 * Shorten achievement in selected cell
 * TODO: Migrate from Code-refactored.gs line 2455
 */
export declare function shorten(): void;
/**
 * Evaluate achievement quality
 * TODO: Migrate from Code-refactored.gs line 2475
 * Note: Renamed from 'eval' to 'evaluate' (eval is a reserved word in strict mode)
 */
export declare function evaluate(): void;
/**
 * Setup API keys for OpenRouter
 * TODO: Migrate from Code-refactored.gs line 3702
 */
export declare function setupAPIKeys(): void;
//# sourceMappingURL=index.d.ts.map