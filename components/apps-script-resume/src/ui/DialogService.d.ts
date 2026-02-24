/**
 * Dialog Service - Manages dialogs and alerts
 *
 * @module ui/DialogService
 */
/**
 * Service for managing dialogs and alerts
 */
export declare class DialogService {
    /**
     * Show modal dialog
     * @param templateName - HTML template file name
     * @param title - Dialog title
     * @param width - Dialog width (optional)
     * @param height - Dialog height (optional)
     */
    static showModal(templateName: string, title: string, width?: number | null, height?: number | null): void;
    /**
     * Show alert dialog
     * @param message - Alert message
     * @param title - Alert title (optional)
     */
    static showAlert(message: string, title?: string): void;
    /**
     * Show prompt dialog
     * @param message - Prompt message
     * @param title - Prompt title
     * @returns User input or null if cancelled
     */
    static showPrompt(message: string, title?: string): string | null;
    /**
     * Show link in modal dialog
     * @param url - URL to display
     * @param title - Dialog title
     */
    static showLink(url: string, title?: string): void;
}
//# sourceMappingURL=DialogService.d.ts.map