/**
 * Workflow Service - Core monthly review logic
 *
 * @module business/WorkflowService
 */
import { ContactRow, SheetService } from '../data/SheetService';
/**
 * A contact flagged for withdrawal action
 */
export interface WithdrawalCandidate {
    contact: ContactRow;
    daysSinceSent: number;
}
/**
 * A contact ready for a re-invite attempt
 */
export interface ReInviteCandidate {
    contact: ContactRow;
    messageToSend: string;
    attemptNumber: number;
}
/**
 * Result of a monthly review run
 */
export interface MonthlyReviewResult {
    toWithdraw: WithdrawalCandidate[];
    toReInvite: ReInviteCandidate[];
}
/**
 * Orchestrates the monthly LinkedIn follow-up workflow
 */
export declare class WorkflowService {
    private sheetService;
    constructor(sheetService: SheetService);
    private daysBetween;
    private addDays;
    private isStatus;
    /**
     * Scans all contacts and identifies:
     * 1. Invitations older than WITHDRAWAL_THRESHOLD days → flag for withdrawal
     * 2. Withdrawn contacts past the LINKEDIN_COOLDOWN window with attempts remaining → flag for re-invite
     */
    runMonthlyReview(): MonthlyReviewResult;
    /**
     * Marks selected contacts as withdrawn and calculates their next eligible re-invite date
     */
    markSelectedAsWithdrawn(): number;
    /**
     * Marks selected contacts as re-invited and advances their attempt counter
     */
    markSelectedAsReInvited(): number;
    /**
     * Marks selected contacts as COMPLETE (no further action needed)
     */
    markSelectedAsComplete(): number;
}
//# sourceMappingURL=WorkflowService.d.ts.map