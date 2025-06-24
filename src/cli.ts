#!/usr/bin/env node

import { Command } from 'commander';
import { JobExtractorAgent } from './agents/job-extractor-agent';
import { JobScorerAgent } from './agents/job-scorer-agent';
import { ResumeCreatorAgent } from './agents/resume-creator-agent';
import { getConfig } from './config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

const program = new Command();

program
  .name('job-extractor')
  .description('Extract and score job information from job posting URLs using AI')
  .version('1.0.0');

program
  .command('extract')
  .description('Extract job information from a URL and automatically score it')
  .argument('<url>', 'URL of the job posting to extract')
  .option('-o, --output <file>', 'Output file to save the extracted data (optional)')
  .option('-f, --format <format>', 'Output format: json or pretty', 'pretty')
  .option('-c, --criteria <file>', 'Path to criteria file for scoring', 'criteria.json')
  .option('--no-score', 'Skip automatic scoring after extraction')
  .action(async (url: string, options) => {
    try {
      console.log('🔍 Extracting job information...');
      console.log(`📄 URL: ${url}`);
      console.log('');

      const config = getConfig();
      const agent = new JobExtractorAgent(config);
      
      const result = await agent.extract(url);

      if (!result.success) {
        console.error('❌ Error:', result.error);
        process.exit(1);
      }

      if (!result.data) {
        console.error('❌ No data extracted');
        process.exit(1);
      }

      // Generate unique job ID from URL
      const jobId = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFileName = `job-${jobId}-${timestamp}.json`;
      const logFilePath = path.join('logs', logFileName);

      // Save JSON to log file
      const jsonOutput = JSON.stringify(result.data, null, 2);
      await fs.writeFile(logFilePath, jsonOutput, 'utf-8');
      console.log(`✅ Job information logged to ${logFilePath}`);

      // Automatically score the job unless --no-score is specified
      if (options.score !== false) {
        console.log('');
        console.log('🎯 Automatically scoring job...');
        
        try {
          const scorer = new JobScorerAgent(config, options.criteria);
          const score = await scorer.scoreJob(jobId);
          
          console.log('✅ Job Scoring Complete');
          console.log('=' .repeat(50));
          console.log(`📊 Overall Score: ${score.overallScore}%`);
          console.log('');
          console.log('📈 Breakdown:');
          console.log(`  Required Skills: ${score.breakdown.required_skills}%`);
          console.log(`  Preferred Skills: ${score.breakdown.preferred_skills}%`);
          console.log(`  Experience Level: ${score.breakdown.experience_level}%`);
          console.log(`  Salary Match: ${score.breakdown.salary}%`);
          console.log(`  Location Match: ${score.breakdown.location}%`);
          console.log(`  Company Match: ${score.breakdown.company_match}%`);
          console.log('');
          console.log('💡 Rationale:');
          console.log(score.rationale);
          
        } catch (scoreError) {
          console.log('⚠️  Scoring failed (extraction was successful):');
          console.log(`   ${scoreError instanceof Error ? scoreError.message : 'Unknown scoring error'}`);
          console.log('   You can manually score later with: job-extractor score ' + jobId);
        }
      }

      // Format output for display
      let output: string;
      if (options.format === 'json') {
        output = jsonOutput;
      } else {
        // output = formatPrettyOutput(result.data);
        output = `✅ Job extracted and logged to ${logFilePath}\n${jsonOutput}`;
      }

      // Output to additional file if specified
      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(`✅ Job information also saved to ${options.output}`);
      // } else {
        // console.log(output);
      }

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// function formatPrettyOutput(data: any): string {
//   let output = '';
//   output += '✅ Job Information Extracted:\n';
//   output += '=' .repeat(50) + '\n\n';
//   output += `📋 Title: ${data.title}\n`;
//   output += `🏢 Company: ${data.company}\n`;
//   output += `📍 Location: ${data.location}\n`;
//   
//   if (data.salary) {
//     output += `💰 Salary: `;
//     if (data.salary.min && data.salary.max) {
//       output += `${data.salary.min} - ${data.salary.max} ${data.salary.currency}\n`;
//     } else if (data.salary.min) {
//       output += `${data.salary.min} ${data.salary.currency}\n`;
//     } else if (data.salary.max) {
//       output += `Up to ${data.salary.max} ${data.salary.currency}\n`;
//     }
//   }
//   
//   output += '\n📝 Description:\n';
//   output += '-' .repeat(20) + '\n';
//   output += data.description + '\n';
//   
//   return output;
// }

program
  .command('score')
  .description('Score a job posting against criteria')
  .argument('<jobId>', 'Job ID to score (from the log filename)')
  .option('-c, --criteria <file>', 'Path to criteria file', 'criteria.json')
  .action(async (jobId: string, options) => {
    try {
      console.log('🎯 Scoring job posting...');
      console.log(`📊 Job ID: ${jobId}`);
      console.log('');

      const config = getConfig();
      const scorer = new JobScorerAgent(config, options.criteria);
      
      const score = await scorer.scoreJob(jobId);
      
      console.log('✅ Job Scoring Complete');
      console.log('=' .repeat(50));
      console.log(`📊 Overall Score: ${score.overallScore}%`);
      console.log('');
      console.log('📈 Breakdown:');
      console.log(`  Required Skills: ${score.breakdown.required_skills}%`);
      console.log(`  Preferred Skills: ${score.breakdown.preferred_skills}%`);
      console.log(`  Experience Level: ${score.breakdown.experience_level}%`);
      console.log(`  Salary Match: ${score.breakdown.salary}%`);
      console.log(`  Location Match: ${score.breakdown.location}%`);
      console.log(`  Company Match: ${score.breakdown.company_match}%`);
      console.log('');
      console.log('💡 Rationale:');
      console.log(score.rationale);
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Generate a tailored resume PDF for a specific job')
  .argument('<jobId>', 'Job ID to tailor resume for (from the log filename)')
  .argument('<cvFile>', 'Path to your CV/resume text file')
  .option('-o, --output <file>', 'Output path for the generated PDF')
  .action(async (jobId: string, cvFile: string, options) => {
    try {
      console.log('📄 Generating tailored resume...');
      console.log(`📊 Job ID: ${jobId}`);
      console.log(`📋 CV File: ${cvFile}`);
      console.log('');

      const config = getConfig();
      const creator = new ResumeCreatorAgent(config);
      
      const result = await creator.createResume(jobId, cvFile, options.output);
      
      if (result.success) {
        console.log('✅ Resume Generation Complete');
        console.log('=' .repeat(50));
        console.log(`📄 PDF Generated: ${result.pdfPath}`);
        
        if (result.tailoringChanges && result.tailoringChanges.length > 0) {
          console.log('');
          console.log('🔧 Tailoring Changes Made:');
          result.tailoringChanges.forEach((change, index) => {
            console.log(`  ${index + 1}. ${change}`);
          });
        }
      } else {
        console.error('❌ Resume generation failed:', result.error);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();