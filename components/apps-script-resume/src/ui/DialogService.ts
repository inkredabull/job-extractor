/**
 * Dialog Service - Manages dialogs and alerts
 *
 * @module ui/DialogService
 */

/**
 * Service for managing dialogs and alerts
 */
export class DialogService {
  /**
   * Show modal dialog
   * @param templateName - HTML template file name
   * @param title - Dialog title
   * @param width - Dialog width (optional)
   * @param height - Dialog height (optional)
   */
  static showModal(
    templateName: string,
    title: string,
    width: number | null = null,
    height: number | null = null
  ): void {
    let html = HtmlService.createTemplateFromFile(templateName).evaluate();

    if (width) html = html.setWidth(width);
    if (height) html = html.setHeight(height);

    SpreadsheetApp.getUi().showModalDialog(html, title);
  }

  /**
   * Show alert dialog
   * @param message - Alert message
   * @param title - Alert title (optional)
   */
  static showAlert(message: string, title: string = 'Alert'): void {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
  }

  /**
   * Show prompt dialog
   * @param message - Prompt message
   * @param title - Prompt title
   * @returns User input or null if cancelled
   */
  static showPrompt(message: string, title: string = 'Input'): string | null {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() === ui.Button.OK) {
      return response.getResponseText();
    }
    return null;
  }

  /**
   * Show link in modal dialog
   * @param url - URL to display
   * @param title - Dialog title
   */
  static showLink(url: string, title: string = 'Document Created'): void {
    const htmlContent = `<p><a href="${url}" target="_blank">${url}</a></p>`;
    const htmlOutput = HtmlService.createHtmlOutput(htmlContent).setWidth(300).setHeight(100);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, title);
  }
}
