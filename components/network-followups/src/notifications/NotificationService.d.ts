/**
 * Notification Service - Builds and sends the monthly Gmail digest
 *
 * @module notifications/NotificationService
 */
import { WithdrawalCandidate, ReInviteCandidate } from '../business/WorkflowService';
/**
 * Sends the monthly action digest email
 */
export declare class NotificationService {
    private readonly recipientEmail;
    constructor();
    /**
     * Sends the monthly digest covering withdrawals and re-invites.
     * Returns true if email was sent, false if there was nothing to report.
     */
    sendMonthlyDigest(toWithdraw: WithdrawalCandidate[], toReInvite: ReInviteCandidate[]): boolean;
    private buildEmailBody;
    private buildHtmlBody;
    private escapeHtml;
}
//# sourceMappingURL=NotificationService.d.ts.map