/**
 * Configuration - Column indices, status enums, and constants
 *
 * @module config
 */
/** Name of the Google Sheet tab */
export declare const SHEET_NAME = "Contacts";
/** Column indices (0-based) matching the 12-column schema */
export declare const COL: {
    readonly NAME: 0;
    readonly LINKEDIN_URL: 1;
    readonly ORIGINAL_MESSAGE: 2;
    readonly DATE_SENT: 3;
    readonly STATUS: 4;
    readonly WITHDRAWN_DATE: 5;
    readonly ATTEMPTS_USED: 6;
    readonly LAST_ATTEMPT_DATE: 7;
    readonly NEXT_ELIGIBLE_DATE: 8;
    readonly VARIANT_1: 9;
    readonly VARIANT_2: 10;
    readonly NOTES: 11;
};
/** Total number of columns in the sheet */
export declare const NUM_COLS = 12;
/** Row number of the header row (1-indexed) */
export declare const HEADER_ROW = 1;
/** First data row (1-indexed) */
export declare const DATA_START_ROW = 2;
/** Status lifecycle for a contact */
export declare const STATUS: {
    readonly INVITED: "INVITED";
    readonly PENDING_WITHDRAWAL: "PENDING_WITHDRAWAL";
    readonly WITHDRAWN: "WITHDRAWN";
    readonly REINVITED_1: "REINVITED_1";
    readonly REINVITED_2: "REINVITED_2";
    readonly COMPLETE: "COMPLETE";
};
export type ContactStatus = (typeof STATUS)[keyof typeof STATUS];
/** Day thresholds for workflow logic */
export declare const DAYS: {
    /** Withdraw invitations older than this many days */
    readonly WITHDRAWAL_THRESHOLD: 30;
    /** LinkedIn blocks re-inviting for this many days after withdrawal */
    readonly LINKEDIN_COOLDOWN: 21;
};
/** Maximum number of re-invite attempts after initial withdrawal */
export declare const MAX_ATTEMPTS = 2;
/** Claude model to use for variant generation */
export declare const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
/** Column header labels (order must match COL indices) */
export declare const HEADERS: string[];
//# sourceMappingURL=index.d.ts.map