/**
 * Network Followups - Google Apps Script Entry Point
 *
 * All functions exported here are exposed as global GAS functions.
 * The gas-webpack-plugin picks these up automatically via autoGlobalExportsFiles.
 *
 * @module index
 */

import { MenuService } from './ui/MenuService';
import { SheetService } from './data/SheetService';
import { WorkflowService } from './business/WorkflowService';
import { VariantService } from './business/VariantService';
import { NotificationService } from './notifications/NotificationService';
import { STATUS } from './config';

// ---------------------------------------------------------------------------
// Service factory (lazy singleton per execution)
// ---------------------------------------------------------------------------

interface Services {
  sheet: SheetService;
  workflow: WorkflowService;
  variant: VariantService;
  notification: NotificationService;
}

let _services: Services | null = null;

function getServices(): Services {
  if (_services) return _services;

  const sheet = new SheetService();
  _services = {
    sheet,
    workflow: new WorkflowService(sheet),
    variant: new VariantService(),
    notification: new NotificationService(),
  };
  return _services;
}

// ---------------------------------------------------------------------------
// GAS lifecycle
// ---------------------------------------------------------------------------

/**
 * Triggered when the spreadsheet is opened — registers the custom menu
 */
export function onOpen(_e?: GoogleAppsScript.Events.SheetsOnOpen): void {
  try {
    MenuService.createCustomMenu(SpreadsheetApp.getUi());
  } catch (e) {
    Logger.log(`onOpen error: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Monthly review (time-based trigger + manual preview)
// ---------------------------------------------------------------------------

/**
 * Runs the full monthly review and sends the digest email.
 * Called automatically by the ScriptApp time-based trigger on the 1st of each month.
 */
export function runMonthlyReview(): void {
  try {
    const { workflow, notification } = getServices();
    const result = workflow.runMonthlyReview();

    const sent = notification.sendMonthlyDigest(result.toWithdraw, result.toReInvite);

    const msg = sent
      ? `Monthly review complete. Email sent with ${result.toWithdraw.length} withdrawal(s) and ${result.toReInvite.length} re-invite(s).`
      : 'Monthly review complete. No action items found — no email sent.';

    Logger.log(msg);
  } catch (e) {
    Logger.log(`runMonthlyReview error: ${(e as Error).message}`);
    throw e;
  }
}

/**
 * Dry-run: shows a UI alert summarising what would be in the next monthly email
 * without actually sending it. Available via menu.
 */
export function previewMonthlyReview(): void {
  try {
    const { workflow } = getServices();
    const result = workflow.runMonthlyReview();
    const ui = SpreadsheetApp.getUi();

    const withdrawList = result.toWithdraw.map((w) => `• ${w.contact.name} (${w.daysSinceSent}d)`).join('\n') || '  (none)';
    const reInviteList = result.toReInvite.map((r) => `• ${r.contact.name} — attempt ${r.attemptNumber}`).join('\n') || '  (none)';

    ui.alert(
      'Monthly Review Preview',
      `WITHDRAW (${result.toWithdraw.length}):\n${withdrawList}\n\nRE-INVITE (${result.toReInvite.length}):\n${reInviteList}\n\nNo email was sent.`,
      ui.ButtonSet.OK
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Error: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Row action menu items
// ---------------------------------------------------------------------------

/**
 * Marks selected row(s) as Withdrawn and calculates their next eligible re-invite date.
 * Menu: ✅ Mark as Withdrawn
 */
export function markWithdrawn(): void {
  try {
    const { workflow } = getServices();
    const count = workflow.markSelectedAsWithdrawn();
    const ui = SpreadsheetApp.getUi();

    if (count === 0) {
      ui.alert('No rows updated. Select rows with status INVITED or PENDING_WITHDRAWAL.');
    } else {
      ui.alert(`✅ Marked ${count} contact(s) as Withdrawn. Next eligible re-invite date has been calculated.`);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Error: ${(e as Error).message}`);
  }
}

/**
 * Marks selected row(s) as Re-invited and increments the attempt counter.
 * Menu: ✅ Mark as Re-invited
 */
export function markReInvited(): void {
  try {
    const { workflow } = getServices();
    const count = workflow.markSelectedAsReInvited();
    const ui = SpreadsheetApp.getUi();

    if (count === 0) {
      ui.alert('No rows updated. Select rows with status WITHDRAWN or REINVITED_1 that still have attempts remaining.');
    } else {
      ui.alert(`✅ Marked ${count} contact(s) as Re-invited.`);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Error: ${(e as Error).message}`);
  }
}

/**
 * Marks selected row(s) as Complete — no further action will be taken.
 * Menu: 🏁 Mark as Complete
 */
export function markComplete(): void {
  try {
    const { workflow } = getServices();
    const count = workflow.markSelectedAsComplete();
    SpreadsheetApp.getUi().alert(`🏁 Marked ${count} contact(s) as Complete.`);
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Error: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Contact management
// ---------------------------------------------------------------------------

/**
 * Prompts the user to enter a new contact and appends them to the sheet.
 * Menu: ➕ Add Contact
 */
export function addContact(): void {
  const ui = SpreadsheetApp.getUi();

  try {
    const nameResp = ui.prompt('Add Contact (1/3)', 'Full name:', ui.ButtonSet.OK_CANCEL);
    if (nameResp.getSelectedButton() !== ui.Button.OK) return;
    const name = nameResp.getResponseText().trim();
    if (!name) { ui.alert('Name cannot be empty.'); return; }

    const urlResp = ui.prompt('Add Contact (2/3)', 'LinkedIn profile URL:', ui.ButtonSet.OK_CANCEL);
    if (urlResp.getSelectedButton() !== ui.Button.OK) return;
    const linkedInUrl = urlResp.getResponseText().trim();

    const msgResp = ui.prompt('Add Contact (3/3)', 'Paste the exact message you sent with your connection request:', ui.ButtonSet.OK_CANCEL);
    if (msgResp.getSelectedButton() !== ui.Button.OK) return;
    const originalMessage = msgResp.getResponseText().trim();

    const { sheet } = getServices();
    sheet.appendContact({
      name,
      linkedInUrl,
      originalMessage,
      dateSent: new Date(),
      status: STATUS.INVITED,
      withdrawnDate: null,
      attemptsUsed: 0,
      lastAttemptDate: null,
      nextEligibleDate: null,
      variant1: '',
      variant2: '',
      notes: '',
    });

    ui.alert(`✅ Added ${name} to the tracker. Run "Generate Message Variants" when ready to prep follow-up messages.`);
  } catch (e) {
    ui.alert(`Error adding contact: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Claude variant generation
// ---------------------------------------------------------------------------

/**
 * Generates two Claude-powered message variants for selected row(s) and writes
 * them into the Variant 1 and Variant 2 columns.
 * Menu: ✨ Generate Message Variants (Claude)
 */
export function generateVariants(): void {
  const ui = SpreadsheetApp.getUi();

  try {
    const { sheet, variant } = getServices();
    const selected = sheet.getSelectedContacts();

    if (selected.length === 0) {
      ui.alert('Select one or more contact rows first.');
      return;
    }

    ui.alert(`Generating variants for ${selected.length} contact(s). This may take a moment…`);

    let count = 0;
    const errors: string[] = [];

    for (const contact of selected) {
      try {
        const variants = variant.generateVariants(contact.originalMessage, contact.name);
        sheet.updateContact(contact.rowIndex, {
          variant1: variants.variant1,
          variant2: variants.variant2,
        });
        count++;
      } catch (e) {
        errors.push(`${contact.name}: ${(e as Error).message}`);
      }
    }

    const summary = `✨ Generated variants for ${count} contact(s).`;
    const errorMsg = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
    ui.alert(summary + errorMsg);
  } catch (e) {
    ui.alert(`Error: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Setup functions
// ---------------------------------------------------------------------------

/**
 * Interactive prompt to save the Anthropic API key to Script Properties.
 * Menu: ⚙️ Setup: Configure API Key
 */
export function setupApiKey(): void {
  const ui = SpreadsheetApp.getUi();

  const resp = ui.prompt(
    'Configure Anthropic API Key',
    'Enter your Anthropic API key (starts with sk-ant-).\n\nThis is stored in Script Properties and never shared.',
    ui.ButtonSet.OK_CANCEL
  );

  if (resp.getSelectedButton() !== ui.Button.OK) return;

  const key = resp.getResponseText().trim();
  if (!key.startsWith('sk-')) {
    ui.alert('That doesn\'t look like a valid Anthropic API key. No changes saved.');
    return;
  }

  PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', key);
  ui.alert('✅ API key saved successfully.');
}

/**
 * Creates a monthly time-based trigger that runs runMonthlyReview() on the 1st of each month at 9am.
 * Run this once after deployment.
 * Menu: ⚙️ Setup: Create Monthly Trigger
 */
export function setupTriggers(): void {
  const ui = SpreadsheetApp.getUi();

  try {
    // Remove any existing monthly triggers to avoid duplicates
    const existing = ScriptApp.getProjectTriggers();
    for (const trigger of existing) {
      if (trigger.getHandlerFunction() === 'runMonthlyReview') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    ScriptApp.newTrigger('runMonthlyReview')
      .timeBased()
      .onMonthDay(1)
      .atHour(9)
      .create();

    ui.alert('✅ Monthly trigger created. runMonthlyReview() will fire on the 1st of each month at 9am.');
  } catch (e) {
    ui.alert(`Error creating trigger: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Global function declarations for Google Apps Script runtime
// ---------------------------------------------------------------------------

declare const global: {
  onOpen: typeof onOpen;
  runMonthlyReview: typeof runMonthlyReview;
  previewMonthlyReview: typeof previewMonthlyReview;
  markWithdrawn: typeof markWithdrawn;
  markReInvited: typeof markReInvited;
  markComplete: typeof markComplete;
  addContact: typeof addContact;
  generateVariants: typeof generateVariants;
  setupApiKey: typeof setupApiKey;
  setupTriggers: typeof setupTriggers;
};

global.onOpen = onOpen;
global.runMonthlyReview = runMonthlyReview;
global.previewMonthlyReview = previewMonthlyReview;
global.markWithdrawn = markWithdrawn;
global.markReInvited = markReInvited;
global.markComplete = markComplete;
global.addContact = addContact;
global.generateVariants = generateVariants;
global.setupApiKey = setupApiKey;
global.setupTriggers = setupTriggers;
