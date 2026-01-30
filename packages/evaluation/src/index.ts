/**
 * @job-extractor/evaluation
 *
 * LangSmith evaluation and monitoring for Job Extractor agents.
 *
 * This package provides both TypeScript and Python interfaces for evaluating
 * job extraction quality using LangSmith.
 */

export * from './types';
export * from './langsmith-runner';

// Re-export for convenience
export { evaluateJob, checkLangSmithSetup } from './langsmith-runner';
