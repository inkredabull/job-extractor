/**
 * TypeScript wrapper for running Python-based LangSmith evaluations
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { EvaluationOptions, EvaluationResult, LangSmithConfig } from './types';

/**
 * Run LangSmith evaluation for a specific job
 */
export async function evaluateJob(
  jobId: string,
  options: EvaluationOptions = {}
): Promise<EvaluationResult> {
  const pythonScript = path.join(__dirname, '../python/src/job_extractor_eval/cli.py');

  const args: string[] = [pythonScript, jobId];

  if (options.termsOnly) {
    args.push('--terms-only');
  }

  if (options.completenessOnly) {
    args.push('--completeness-only');
  }

  return new Promise((resolve) => {
    const process = spawn('python', args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      if (options.verbose) {
        console.log(data.toString());
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      if (options.verbose) {
        console.error(data.toString());
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to parse metrics from output
          // For now, just return success with raw output
          resolve({
            success: true,
            metrics: {
              job_id: jobId,
            },
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse evaluation output: ${error}`,
            stderr,
          });
        }
      } else {
        resolve({
          success: false,
          error: `Evaluation failed with exit code ${code}`,
          stderr,
        });
      }
    });

    process.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to start Python process: ${error.message}`,
      });
    });
  });
}

/**
 * Check if LangSmith is properly configured
 */
export async function checkLangSmithSetup(config?: LangSmithConfig): Promise<boolean> {
  const pythonScript = path.join(__dirname, '../python/src/job_extractor_eval/cli.py');

  return new Promise((resolve) => {
    const process = spawn('python', [pythonScript, '--check-setup']);

    let isConnected = false;

    process.stdout.on('data', (data) => {
      const output = data.toString();
      if (config?.verbose) {
        console.log(output);
      }
      if (output.includes('✅ LangSmith API connection successful')) {
        isConnected = true;
      }
    });

    process.on('close', (code) => {
      resolve(code === 0 && isConnected);
    });

    process.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Run evaluation using direct Python module invocation
 */
export async function evaluateWithPython(
  jobId: string,
  options: EvaluationOptions = {}
): Promise<EvaluationResult> {
  // Alternative: Use python -m syntax
  const args: string[] = ['-m', 'job_extractor_eval.cli', jobId];

  if (options.termsOnly) {
    args.push('--terms-only');
  }

  if (options.completenessOnly) {
    args.push('--completeness-only');
  }

  return new Promise((resolve) => {
    const process = spawn('python', args, {
      cwd: path.join(__dirname, '../python'),
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      if (options.verbose) {
        console.log(data.toString());
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          metrics: { job_id: jobId },
        });
      } else {
        resolve({
          success: false,
          error: `Evaluation failed with exit code ${code}`,
          stderr,
        });
      }
    });

    process.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to run evaluation: ${error.message}`,
      });
    });
  });
}
