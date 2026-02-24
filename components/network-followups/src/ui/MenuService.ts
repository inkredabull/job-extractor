/**
 * Menu Service - Registers the "Network Followups" custom menu in the sheet
 *
 * @module ui/MenuService
 */

/**
 * Creates the Network Followups custom menu in the spreadsheet UI
 */
export class MenuService {
  static createCustomMenu(ui: GoogleAppsScript.Base.Ui): void {
    ui.createMenu('Network Followups')
      .addItem('➕ Add Contact', 'addContact')
      .addSeparator()
      .addItem('✅ Mark as Withdrawn', 'markWithdrawn')
      .addItem('✅ Mark as Re-invited', 'markReInvited')
      .addItem('🏁 Mark as Complete', 'markComplete')
      .addSeparator()
      .addItem('✨ Generate Message Variants (Claude)', 'generateVariants')
      .addSeparator()
      .addItem('📬 Preview Monthly Review (dry run)', 'previewMonthlyReview')
      .addItem('⚙️ Setup: Configure API Key', 'setupApiKey')
      .addItem('⚙️ Setup: Create Monthly Trigger', 'setupTriggers')
      .addToUi();
  }
}
