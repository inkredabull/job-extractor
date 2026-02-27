/**
 * Example: Integrating Google Sheets logging into job scoring workflow
 *
 * This shows how to automatically log job analyses to Google Sheets
 */

import { SheetsLogger, createSheetsLogger } from '../components/core/src/integrations/sheets-logger';
import { JobScore, JobListing } from '../components/core/src/types';

/**
 * Example 1: Basic integration with job scoring
 */
async function exampleJobScoring() {
  // Initialize the sheets logger from environment variables
  const sheetsLogger = createSheetsLogger();

  if (!sheetsLogger) {
    console.log('⚠️ Google Sheets integration not configured');
    console.log('   Add GOOGLE_SHEETS_URL to .env to enable');
    return;
  }

  // Simulate a job that was analyzed
  const jobId = 'JOB-' + Date.now();
  const jobUrl = 'https://example.com/jobs/123';

  const jobListing: JobListing = {
    title: 'Senior Software Engineer',
    company: 'Acme Corp',
    location: 'San Francisco, CA',
    description: 'We are looking for a senior engineer...',
    salary: {
      min: '180000',
      max: '250000',
      currency: 'USD'
    }
  };

  const jobScore: JobScore = {
    jobId: jobId,
    overallScore: 87,
    rationale: 'Strong match for required skills and experience. Salary aligns with expectations. Remote-friendly culture.',
    breakdown: {
      required_skills: 95,
      preferred_skills: 80,
      experience_level: 90,
      salary: 85,
      location: 90,
      company_match: 75
    }
  };

  // Log to Google Sheets
  await sheetsLogger.logJobAnalysis(
    jobId,
    jobListing,
    jobScore,
    jobUrl,
    {
      origin: 'LinkedIn',
      threshold: 75
    }
  );

  console.log('✅ Job analysis logged to Google Sheets');
}

/**
 * Example 2: Update job status as you progress
 */
async function exampleStatusUpdates() {
  const sheetsLogger = createSheetsLogger();
  if (!sheetsLogger) return;

  const jobId = 'JOB-1234';

  // When you apply
  await sheetsLogger.markAsApplied(
    jobId,
    'https://drive.google.com/file/d/xyz/view' // Resume URL
  );

  // When you get an interview
  await sheetsLogger.markAsInterview(
    jobId,
    'Phone screen scheduled for Friday 2pm PST'
  );

  // If you get rejected
  await sheetsLogger.markAsRejected(
    jobId,
    'Position filled internally'
  );

  console.log('✅ Status updates logged');
}

/**
 * Example 3: Track "Who Got Hired" for competitive analysis
 */
async function exampleWhoGotHired() {
  const sheetsLogger = createSheetsLogger();
  if (!sheetsLogger) return;

  const jobId = 'JOB-1234';

  // When you find out who got the job
  await sheetsLogger.recordWhoGotHired(
    jobId,
    'John Doe',
    'https://linkedin.com/in/johndoe'
  );

  console.log('✅ "Who Got Hired" information recorded');
}

/**
 * Example 4: Manual configuration (not using environment variables)
 */
async function exampleManualConfiguration() {
  const sheetsLogger = new SheetsLogger({
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/13j0Gfao85oJd27oXpyAMyTL2iSkJCxaB3q_U5wyb4Oc',
    sheetName: 'Sheet1',
    enabled: true
  });

  // ... use sheetsLogger as in other examples
}

/**
 * Example 5: Integrating into existing job scoring CLI
 */
async function integrateIntoScoreJobCommand(jobUrl: string) {
  // Your existing job scoring logic
  const result = await scoreJob(jobUrl); // Your existing function

  if (!result.success) {
    console.error('Job scoring failed');
    return;
  }

  // Add Google Sheets logging
  const sheetsLogger = createSheetsLogger();
  if (sheetsLogger) {
    try {
      await sheetsLogger.logJobAnalysis(
        result.jobId!,
        result.data!,
        result.score!, // Assuming your result includes score
        jobUrl,
        {
          origin: 'CLI',
          threshold: 75
        }
      );
    } catch (error) {
      // Don't fail the command if sheets logging fails
      console.error('⚠️ Failed to log to Google Sheets:', error);
    }
  }

  return result;
}

/**
 * Mock function for example purposes
 */
async function scoreJob(jobUrl: string): Promise<any> {
  // This would be your actual job scoring logic
  return {
    success: true,
    jobId: 'JOB-123',
    data: {} as JobListing,
    score: {} as JobScore
  };
}

// Run examples
if (require.main === module) {
  console.log('🧪 Running Google Sheets integration examples\n');

  Promise.all([
    exampleJobScoring(),
    // exampleStatusUpdates(),
    // exampleWhoGotHired(),
  ])
    .then(() => {
      console.log('\n✅ All examples completed');
    })
    .catch(error => {
      console.error('\n❌ Example failed:', error);
      process.exit(1);
    });
}
