/**
 * Main entry point for the apps-script-resume module
 * Exports all public APIs and entry points
 */

// Export configuration
export { CONFIG } from './config';

// Export utilities
export { Logger } from './utils/Logger';
export { ValidationUtils } from './utils/ValidationUtils';
export { TextUtils } from './utils/TextUtils';

// Export data services
export { SheetService } from './data/SheetService';
export { ConfigService } from './data/ConfigService';
export { ModelDiscoveryService } from './data/ModelDiscoveryService';

// Export AI services
export { AIProviderBase } from './ai/AIProviderBase';
export { OpenRouterProvider } from './ai/OpenRouterProvider';
export { AIService } from './ai/AIService';

// Export document services
export { DocumentService } from './document/DocumentService';

// Export business services
export { AchievementService } from './business/AchievementService';
export { EvaluationService } from './business/EvaluationService';
export { CustomizationService } from './business/CustomizationService';
export { ResumeFormatter } from './business/ResumeFormatter';
export { WorkHistoryExporter } from './business/WorkHistoryExporter';

// Export UI services
export { MenuService } from './ui/MenuService';
export { DialogService } from './ui/DialogService';

// Export all entry points (global functions for Google Apps Script)
export * from './entry-points';
