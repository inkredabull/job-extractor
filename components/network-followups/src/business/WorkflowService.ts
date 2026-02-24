/**
 * Workflow Service - Core monthly review logic
 *
 * @module business/WorkflowService
 */

import { STATUS, DAYS, MAX_ATTEMPTS, ContactStatus } from '../config';
import { ContactRow, SheetService, ContactUpdate } from '../data/SheetService';

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
  messageToSend: string; // variant1 or variant2 depending on attempt count
  attemptNumber: number; // 1 or 2
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
export class WorkflowService {
  private sheetService: SheetService;

  constructor(sheetService: SheetService) {
    this.sheetService = sheetService;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((b.getTime() - a.getTime()) / msPerDay);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  private isStatus(contact: ContactRow, ...statuses: ContactStatus[]): boolean {
    return statuses.includes(contact.status);
  }

  // ---------------------------------------------------------------------------
  // Monthly review
  // ---------------------------------------------------------------------------

  /**
   * Scans all contacts and identifies:
   * 1. Invitations older than WITHDRAWAL_THRESHOLD days → flag for withdrawal
   * 2. Withdrawn contacts past the LINKEDIN_COOLDOWN window with attempts remaining → flag for re-invite
   */
  runMonthlyReview(): MonthlyReviewResult {
    const today = new Date();
    const contacts = this.sheetService.getAllContacts();

    const toWithdraw: WithdrawalCandidate[] = [];
    const toReInvite: ReInviteCandidate[] = [];

    for (const contact of contacts) {
      // --- Withdrawal candidates ---
      if (
        this.isStatus(contact, STATUS.INVITED, STATUS.PENDING_WITHDRAWAL) &&
        contact.dateSent !== null
      ) {
        const daysSinceSent = this.daysBetween(contact.dateSent, today);
        if (daysSinceSent >= DAYS.WITHDRAWAL_THRESHOLD) {
          toWithdraw.push({ contact, daysSinceSent });
        }
      }

      // --- Re-invite candidates ---
      if (
        this.isStatus(contact, STATUS.WITHDRAWN, STATUS.REINVITED_1) &&
        contact.attemptsUsed < MAX_ATTEMPTS &&
        contact.nextEligibleDate !== null &&
        today >= contact.nextEligibleDate
      ) {
        // Determine which variant to use based on attempt count
        const attemptNumber = contact.attemptsUsed + 1;
        const messageToSend =
          attemptNumber === 1
            ? contact.variant1 || contact.originalMessage
            : contact.variant2 || contact.variant1 || contact.originalMessage;

        toReInvite.push({ contact, messageToSend, attemptNumber });
      }
    }

    return { toWithdraw, toReInvite };
  }

  // ---------------------------------------------------------------------------
  // User action handlers (called from menu)
  // ---------------------------------------------------------------------------

  /**
   * Marks selected contacts as withdrawn and calculates their next eligible re-invite date
   */
  markSelectedAsWithdrawn(): number {
    const today = new Date();
    const selected = this.sheetService.getSelectedContacts();
    let count = 0;

    for (const contact of selected) {
      if (!this.isStatus(contact, STATUS.INVITED, STATUS.PENDING_WITHDRAWAL)) continue;

      const nextEligible = this.addDays(today, DAYS.LINKEDIN_COOLDOWN);

      const update: ContactUpdate = {
        status: STATUS.WITHDRAWN,
        withdrawnDate: today,
        nextEligibleDate: nextEligible,
      };

      this.sheetService.updateContact(contact.rowIndex, update);
      count++;
    }

    return count;
  }

  /**
   * Marks selected contacts as re-invited and advances their attempt counter
   */
  markSelectedAsReInvited(): number {
    const today = new Date();
    const selected = this.sheetService.getSelectedContacts();
    let count = 0;

    for (const contact of selected) {
      if (!this.isStatus(contact, STATUS.WITHDRAWN, STATUS.REINVITED_1)) continue;
      if (contact.attemptsUsed >= MAX_ATTEMPTS) continue;

      const newAttempts = contact.attemptsUsed + 1;
      const newStatus: ContactStatus =
        newAttempts >= MAX_ATTEMPTS ? STATUS.REINVITED_2 : STATUS.REINVITED_1;

      const update: ContactUpdate = {
        status: newStatus,
        attemptsUsed: newAttempts,
        lastAttemptDate: today,
        // Next eligible is null — no more re-invites after MAX_ATTEMPTS
        nextEligibleDate: newAttempts >= MAX_ATTEMPTS ? null : this.addDays(today, DAYS.LINKEDIN_COOLDOWN),
      };

      this.sheetService.updateContact(contact.rowIndex, update);
      count++;
    }

    return count;
  }

  /**
   * Marks selected contacts as COMPLETE (no further action needed)
   */
  markSelectedAsComplete(): number {
    const selected = this.sheetService.getSelectedContacts();
    let count = 0;

    for (const contact of selected) {
      this.sheetService.updateContact(contact.rowIndex, { status: STATUS.COMPLETE });
      count++;
    }

    return count;
  }
}
