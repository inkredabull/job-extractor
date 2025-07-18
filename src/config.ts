import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { AgentConfig } from './types';

dotenv.config();

export function getConfig(): AgentConfig {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return {
    openaiApiKey,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    temperature: process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.3,
    maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS) : 2000,
  };
}

export function getAnthropicConfig(): { anthropicApiKey: string; model: string; maxTokens: number } {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  return {
    anthropicApiKey,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: process.env.ANTHROPIC_MAX_TOKENS ? parseInt(process.env.ANTHROPIC_MAX_TOKENS) : 4000,
  };
}

export function getAutoResumeConfig(): { threshold: number; cvPath: string | null } {
  return {
    threshold: process.env.AUTO_RESUME_THRESHOLD ? parseInt(process.env.AUTO_RESUME_THRESHOLD) : 80,
    cvPath: process.env.AUTO_RESUME_CV_PATH || null,
  };
}

export function getResumeOutputDir(): string {
  const envDir = process.env.RESUME_OUTPUT_DIR;
  if (envDir) {
    // Handle tilde expansion for home directory
    if (envDir.startsWith('~/')) {
      const homeDir = os.homedir();
      return path.join(homeDir, envDir.slice(2));
    }
    return envDir;
  }
  
  // Fallback to default Google Drive location
  const homeDir = os.homedir();
  return path.join(homeDir, 'Google Drive', 'My Drive', 'Professional', 'Job Search', 'Applications', 'Resumes');
}