#!/usr/bin/env ts-node

/**
 * Example script to add a job to the Google Sheets tracking spreadsheet
 *
 * Usage:
 *   ts-node scripts/add-job-to-sheet.ts
 *
 * Or with custom data:
 *   ts-node scripts/add-job-to-sheet.ts --id "ABC123" --role "Senior Engineer" --company "Acme Corp"
 */

import { GoogleSheetsClient, extractSpreadsheetId, formatDate, JobRow } from '../components/core/src/utils/google-sheets';
import dotenv from 'dotenv';

dotenv.config();

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/13j0Gfao85oJd27oXpyAMyTL2iSkJCxaB3q_U5wyb4Oc';
const SHEET_NAME = 'Sheet1'; // Update this to match your actual sheet name

async function main() {
  try {
    const spreadsheetId = extractSpreadsheetId(SPREADSHEET_URL);
    console.log(`📊 Spreadsheet ID: ${spreadsheetId}`);

    const client = new GoogleSheetsClient();

    // Example job data - customize as needed
    const jobData: JobRow = {
      id: 'JOB-' + Date.now(), // Generate unique ID
      role: 'Senior Software Engineer',
      company: 'Example Corp',
      status: 'Applied',
      applied: formatDate(), // Today's date
      updated: formatDate(),
      notes: 'Added via script',
      origin: 'LinkedIn',
      score: '85%',
      threshold: 'Yes',
      jobUrl: 'https://example.com/job',
      jobTitleShorthand: 'SSE'
    };

    // Parse command-line arguments
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      if (value) {
        (jobData as any)[key] = value;
      }
    }

    console.log('\n📝 Job data to insert:');
    console.log(JSON.stringify(jobData, null, 2));
    console.log('');

    // Insert at top (row 2, below headers)
    console.log('🔄 Inserting row at top of sheet...');
    await client.insertRowAtTop(spreadsheetId, SHEET_NAME, jobData);

    console.log('✅ Success! Row inserted at the top of the sheet.');
    console.log(`🔗 View: ${SPREADSHEET_URL}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Example of reading all rows
async function listJobs() {
  try {
    const spreadsheetId = extractSpreadsheetId(SPREADSHEET_URL);
    const client = new GoogleSheetsClient();

    console.log('📋 Reading all jobs from sheet...\n');
    const jobs = await client.readAll(spreadsheetId, SHEET_NAME);

    console.log(`Found ${jobs.length} jobs:\n`);
    jobs.slice(0, 5).forEach(job => {
      console.log(`• ${job.id} - ${job.role} at ${job.company} (${job.status})`);
    });

    if (jobs.length > 5) {
      console.log(`  ... and ${jobs.length - 5} more`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Example of updating a row
async function updateJob(id: string, updates: Partial<JobRow>) {
  try {
    const spreadsheetId = extractSpreadsheetId(SPREADSHEET_URL);
    const client = new GoogleSheetsClient();

    console.log(`🔄 Updating job ${id}...`);
    await client.updateRowById(spreadsheetId, SHEET_NAME, id, updates);

    console.log('✅ Job updated successfully');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'list') {
    listJobs();
  } else if (command === 'update' && process.argv[3]) {
    const id = process.argv[3];
    const updates = { status: 'Rejected', updated: formatDate() };
    updateJob(id, updates);
  } else {
    main();
  }
}
