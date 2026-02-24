/**
 * Network Followups - Google Apps Script Entry Point
 *
 * All functions exported here are exposed as global GAS functions.
 * The gas-webpack-plugin picks these up automatically via autoGlobalExportsFiles.
 *
 * @module index
 */
/**
 * Triggered when the spreadsheet is opened — registers the custom menu
 */
export declare function onOpen(_e?: GoogleAppsScript.Events.SheetsOnOpen): void;
/**
 * Runs the full monthly review and sends the digest email.
 * Called automatically by the ScriptApp time-based trigger on the 1st of each month.
 */
export declare function runMonthlyReview(): void;
/**
 * Dry-run: shows a UI alert summarising what would be in the next monthly email
 * without actually sending it. Available via menu.
 */
export declare function previewMonthlyReview(): void;
/**
 * Marks selected row(s) as Withdrawn and calculates their next eligible re-invite date.
 * Menu: ✅ Mark as Withdrawn
 */
export declare function markWithdrawn(): void;
/**
 * Marks selected row(s) as Re-invited and increments the attempt counter.
 * Menu: ✅ Mark as Re-invited
 */
export declare function markReInvited(): void;
/**
 * Marks selected row(s) as Complete — no further action will be taken.
 * Menu: 🏁 Mark as Complete
 */
export declare function markComplete(): void;
/**
 * Prompts the user to enter a new contact and appends them to the sheet.
 * Menu: ➕ Add Contact
 */
export declare function addContact(): void;
/**
 * Generates two Claude-powered message variants for selected row(s) and writes
 * them into the Variant 1 and Variant 2 columns.
 * Menu: ✨ Generate Message Variants (Claude)
 */
export declare function generateVariants(): void;
/**
 * Interactive prompt to save the Anthropic API key to Script Properties.
 * Menu: ⚙️ Setup: Configure API Key
 */
export declare function setupApiKey(): void;
/**
 * Creates a monthly time-based trigger that runs runMonthlyReview() on the 1st of each month at 9am.
 * Run this once after deployment.
 * Menu: ⚙️ Setup: Create Monthly Trigger
 */
export declare function setupTriggers(): void;
//# sourceMappingURL=index.d.ts.map