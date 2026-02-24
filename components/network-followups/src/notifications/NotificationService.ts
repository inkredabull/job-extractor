/**
 * Notification Service - Builds and sends the monthly Gmail digest
 *
 * @module notifications/NotificationService
 */

import { WithdrawalCandidate, ReInviteCandidate } from '../business/WorkflowService';

/**
 * Sends the monthly action digest email
 */
export class NotificationService {
  private readonly recipientEmail: string;

  constructor() {
    // Use the authenticated user's email as recipient
    this.recipientEmail = Session.getActiveUser().getEmail();
  }

  /**
   * Sends the monthly digest covering withdrawals and re-invites.
   * Returns true if email was sent, false if there was nothing to report.
   */
  sendMonthlyDigest(
    toWithdraw: WithdrawalCandidate[],
    toReInvite: ReInviteCandidate[]
  ): boolean {
    if (toWithdraw.length === 0 && toReInvite.length === 0) {
      return false;
    }

    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM d, yyyy');

    const subject = `🔗 LinkedIn Network Followups — ${dateStr}`;
    const body = this.buildEmailBody(toWithdraw, toReInvite, dateStr);

    GmailApp.sendEmail(this.recipientEmail, subject, body, {
      htmlBody: this.buildHtmlBody(toWithdraw, toReInvite, dateStr),
      name: 'Network Followups',
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // Private: plain-text body
  // ---------------------------------------------------------------------------

  private buildEmailBody(
    toWithdraw: WithdrawalCandidate[],
    toReInvite: ReInviteCandidate[],
    dateStr: string
  ): string {
    const lines: string[] = [
      `LinkedIn Network Followups — ${dateStr}`,
      '='.repeat(50),
      '',
    ];

    if (toWithdraw.length > 0) {
      lines.push(`SECTION 1: WITHDRAW THESE (${toWithdraw.length})`, '-'.repeat(40));
      lines.push('Open each profile, withdraw the pending invitation, then select the row(s) in the sheet and click Network Followups → ✅ Mark as Withdrawn.', '');

      for (const item of toWithdraw) {
        lines.push(
          `• ${item.contact.name} (${item.daysSinceSent} days ago)`,
          `  ${item.contact.linkedInUrl}`,
          `  Original message: "${item.contact.originalMessage}"`,
          ''
        );
      }
    }

    if (toReInvite.length > 0) {
      lines.push('', `SECTION 2: RE-INVITE THESE (${toReInvite.length})`, '-'.repeat(40));
      lines.push('Send a new connection request using the message below, then select the row(s) in the sheet and click Network Followups → ✅ Mark as Re-invited.', '');

      for (const item of toReInvite) {
        lines.push(
          `• ${item.contact.name} — Attempt ${item.attemptNumber} of 2`,
          `  ${item.contact.linkedInUrl}`,
          `  Message to send:`,
          `  "${item.messageToSend}"`,
          ''
        );
      }
    }

    lines.push('', '— Network Followups (career-catalyst)');
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Private: HTML body
  // ---------------------------------------------------------------------------

  private buildHtmlBody(
    toWithdraw: WithdrawalCandidate[],
    toReInvite: ReInviteCandidate[],
    dateStr: string
  ): string {
    const styles = `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1d1d1f; max-width: 680px; margin: 0 auto; padding: 24px; }
      h1 { font-size: 22px; color: #0a66c2; margin-bottom: 4px; }
      h2 { font-size: 16px; color: #444; border-bottom: 2px solid #0a66c2; padding-bottom: 6px; margin-top: 32px; }
      .card { background: #f8f9fa; border-left: 4px solid #0a66c2; border-radius: 4px; padding: 14px 16px; margin: 12px 0; }
      .card.reinvite { border-left-color: #057642; }
      .name { font-weight: 600; font-size: 15px; }
      .meta { color: #666; font-size: 13px; margin: 4px 0; }
      .link a { color: #0a66c2; text-decoration: none; font-size: 13px; }
      .message { background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; margin-top: 8px; font-style: italic; font-size: 14px; color: #333; }
      .instructions { background: #fffbe6; border: 1px solid #f0c040; border-radius: 4px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
      .badge { display: inline-block; background: #0a66c2; color: #fff; border-radius: 12px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-left: 8px; }
      .badge.green { background: #057642; }
    `;

    const sections: string[] = [`<style>${styles}</style>`, `<h1>🔗 LinkedIn Network Followups</h1>`, `<p style="color:#666;font-size:14px;">${dateStr}</p>`];

    if (toWithdraw.length > 0) {
      sections.push(`<h2>Section 1: Withdraw These <span class="badge">${toWithdraw.length}</span></h2>`);
      sections.push(`<div class="instructions">Open each profile → withdraw the pending invite → select the row(s) in the sheet → <strong>Network Followups → ✅ Mark as Withdrawn</strong></div>`);

      for (const item of toWithdraw) {
        sections.push(`
          <div class="card">
            <div class="name">${this.escapeHtml(item.contact.name)}</div>
            <div class="meta">Sent ${item.daysSinceSent} days ago</div>
            <div class="link"><a href="${this.escapeHtml(item.contact.linkedInUrl)}" target="_blank">View LinkedIn Profile →</a></div>
            <div class="message">"${this.escapeHtml(item.contact.originalMessage)}"</div>
          </div>
        `);
      }
    }

    if (toReInvite.length > 0) {
      sections.push(`<h2>Section 2: Re-invite These <span class="badge green">${toReInvite.length}</span></h2>`);
      sections.push(`<div class="instructions">Send a new connection request using the message below → select the row(s) in the sheet → <strong>Network Followups → ✅ Mark as Re-invited</strong></div>`);

      for (const item of toReInvite) {
        sections.push(`
          <div class="card reinvite">
            <div class="name">${this.escapeHtml(item.contact.name)} <span style="font-size:12px;color:#666;font-weight:400;">Attempt ${item.attemptNumber} of 2</span></div>
            <div class="link"><a href="${this.escapeHtml(item.contact.linkedInUrl)}" target="_blank">View LinkedIn Profile →</a></div>
            <div style="margin-top:8px;font-size:13px;color:#444;font-weight:500;">Copy this message:</div>
            <div class="message">"${this.escapeHtml(item.messageToSend)}"</div>
          </div>
        `);
      }
    }

    sections.push('<p style="color:#999;font-size:12px;margin-top:32px;">— Network Followups · career-catalyst</p>');

    return sections.join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
