/**
 * Resume & Achievement Management System - Main Entry Point
 *
 * A comprehensive Google Apps Script for managing work history,
 * generating achievements, and creating tailored resumes using AI.
 *
 * @author Anthony Bull
 * @version 3.0.0
 * @description Built with TypeScript and modern module system
 */

// Export all entry point functions to make them globally available in Google Apps Script
export * from './entry-points';

// Export configuration for external access
export { CONFIG } from './config';

// Export services for programmatic access
export { Logger } from './utils/Logger';
export { ValidationUtils } from './utils/ValidationUtils';
export { TextUtils } from './utils/TextUtils';

// Data layer
export { SheetService } from './data/SheetService';
export { ConfigService } from './data/ConfigService';
export { ModelDiscoveryService } from './data/ModelDiscoveryService';

// AI layer
export { AIProviderBase } from './ai/AIProviderBase';
export { OpenRouterProvider } from './ai/OpenRouterProvider';
export { AIService } from './ai/AIService';

// Document layer
export { DocumentService } from './document/DocumentService';

// Business logic layer
export { AchievementService } from './business/AchievementService';
export { ResumeFormatter } from './business/ResumeFormatter';

// UI layer
export { MenuService } from './ui/MenuService';
