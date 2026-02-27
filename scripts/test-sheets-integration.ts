#!/usr/bin/env ts-node

/**
 * Test script to verify Google Sheets integration
 *
 * Usage:
 *   ts-node scripts/test-sheets-integration.ts
 */

import { GoogleSheetsClient, extractSpreadsheetId, formatDate, JobRow } from '../components/core/src/utils/google-sheets';
import dotenv from 'dotenv';

dotenv.config();

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/13j0Gfao85oJd27oXpyAMyTL2iSkJCxaB3q_U5wyb4Oc';

async function testIntegration() {
  console.log('🧪 Testing Google Sheets Integration\n');
  console.log('='.repeat(60));

  try {
    // Extract spreadsheet ID
    const spreadsheetId = extractSpreadsheetId(SPREADSHEET_URL);
    console.log(`\n✅ Spreadsheet ID extracted: ${spreadsheetId}`);

    // Initialize client
    const client = new GoogleSheetsClient();
    console.log('✅ Google Sheets client initialized');

    // Check authentication
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      console.error('\n❌ GOOGLE_REFRESH_TOKEN not found in .env');
      console.error('   Run: npm run setup-gmail');
      process.exit(1);
    }
    console.log('✅ OAuth token found');

    // Prompt for operation first
    console.log('\n📋 Available operations:');
    console.log('   1. Read all rows (to verify connection)');
    console.log('   2. Insert a test row at the top');
    console.log('   3. Insert a test row at the bottom');
    console.log('   4. Exit');
    console.log('');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Select operation (1-4): ', async (choice: string) => {
      const operation = choice.trim();

      // Exit early if user chose exit
      if (operation === '4') {
        rl.close();
        console.log('\n👋 Exiting...');
        process.exit(0);
      }

      // Validate choice
      if (!['1', '2', '3'].includes(operation)) {
        rl.close();
        console.error('\n❌ Invalid choice');
        process.exit(1);
      }

      // Now ask for sheet name
      rl.question('\nEnter sheet name (default: Sheet1): ', async (sheetName: string) => {
        rl.close();
        sheetName = sheetName.trim() || 'Sheet1';
        console.log(`\n📊 Using sheet: "${sheetName}"`);

        try {
          switch (operation) {
            case '1':
              await testRead(client, spreadsheetId, sheetName);
              break;
            case '2':
              await testInsertTop(client, spreadsheetId, sheetName);
              break;
            case '3':
              await testAppend(client, spreadsheetId, sheetName);
              break;
          }
        } catch (error: any) {
          console.error('\n❌ Test failed:', error.message);
          if (error.message?.includes('invalid_grant')) {
            console.error('\n🔑 OAuth token expired or invalid');
            console.error('   Re-run: npm run setup-gmail');
          }
          process.exit(1);
        }
      });
    });

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

async function testRead(client: GoogleSheetsClient, spreadsheetId: string, sheetName: string) {
  console.log('\n📖 Reading all rows from sheet...');

  const jobs = await client.readAll(spreadsheetId, sheetName);

  console.log(`\n✅ Successfully read ${jobs.length} rows\n`);

  if (jobs.length === 0) {
    console.log('   (Sheet appears empty or only has headers)');
  } else {
    console.log('First 3 rows:');
    jobs.slice(0, 3).forEach((job, index) => {
      console.log(`\n${index + 1}. ${job.id || '(no ID)'}`);
      console.log(`   Role: ${job.role || '(empty)'}`);
      console.log(`   Company: ${job.company || '(empty)'}`);
      console.log(`   Status: ${job.status || '(empty)'}`);
    });

    if (jobs.length > 3) {
      console.log(`\n   ... and ${jobs.length - 3} more rows`);
    }
  }

  console.log('\n✅ Read test passed!');
}

async function testInsertTop(client: GoogleSheetsClient, spreadsheetId: string, sheetName: string) {
  console.log('\n📝 Inserting test row at top (row 2)...');

  const testJob: JobRow = {
    id: `TEST-${Date.now()}`,
    role: '🧪 Test Role - DELETE ME',
    company: 'Test Company',
    status: 'Test',
    applied: formatDate(),
    updated: formatDate(),
    notes: 'This is a test row created by test-sheets-integration.ts - safe to delete',
    origin: 'Test Script',
    score: '100%',
    threshold: 'Yes'
  };

  await client.insertRowAtTop(spreadsheetId, sheetName, testJob);

  console.log('\n✅ Insert test passed!');
  console.log(`\n📊 View the spreadsheet:`);
  console.log(`   ${SPREADSHEET_URL}`);
  console.log('\n💡 You should see the test row at the top (row 2)');
  console.log('   Feel free to delete it manually');
}

async function testAppend(client: GoogleSheetsClient, spreadsheetId: string, sheetName: string) {
  console.log('\n📝 Appending test row at bottom...');

  const testJob: JobRow = {
    id: `TEST-APPEND-${Date.now()}`,
    role: '🧪 Test Append - DELETE ME',
    company: 'Test Company',
    status: 'Test',
    applied: formatDate(),
    updated: formatDate(),
    notes: 'This is a test row appended by test-sheets-integration.ts - safe to delete',
    origin: 'Test Script',
    score: '100%',
    threshold: 'Yes'
  };

  await client.appendRow(spreadsheetId, sheetName, testJob);

  console.log('\n✅ Append test passed!');
  console.log(`\n📊 View the spreadsheet:`);
  console.log(`   ${SPREADSHEET_URL}`);
  console.log('\n💡 You should see the test row at the bottom');
  console.log('   Feel free to delete it manually');
}

// Run the test
if (require.main === module) {
  testIntegration();
}
