#!/usr/bin/env node

import { Command } from 'commander';
import { JobExtractorAgent } from './agents/job-extractor-agent';
import { JobScorerAgent } from './agents/job-scorer-agent';
import { ResumeCreatorAgent } from './agents/resume-creator-agent';
import { ResumeCriticAgent } from './agents/resume-critic-agent';
import { InterviewPrepAgent } from './agents/interview-prep-agent';
import { OutreachAgent } from './agents/outreach-agent';
import { MetricsAgent } from './agents/metrics-agent';
import { ApplicationAgent } from './agents/application-agent';
import { WhoGotHiredAgent } from './agents/whogothired-agent';
import { StatementType } from './types';
import { getConfig, getAnthropicConfig } from './config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';

// Helper function to find CV file automatically
async function findCvFile(): Promise<string> {
  const possiblePaths = [
    'cv.txt',
    './cv.txt',
    'CV.txt',
    './CV.txt',
    'sample-cv.txt',
    './sample-cv.txt'
  ];
  
  for (const cvPath of possiblePaths) {
    try {
      await fs.access(cvPath);
      console.log(`📄 Found CV file: ${cvPath}`);
      return cvPath;
    } catch {
      // File doesn't exist, continue searching
    }
  }
  
  throw new Error('CV file not found. Please create a cv.txt file in the current directory or specify the path.');
}

// Convert Markdown-style text to RTF format
function convertMarkdownToRTF(content: string): string {
  // RTF header
  let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
  
  // Convert content line by line
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle different markdown elements
    if (line.startsWith('**') && line.endsWith('**')) {
      // Bold headers
      const text = line.slice(2, -2);
      rtf += `\\par \\b ${escapeRTF(text)}\\b0`;
    } else if (line.match(/^(\s*)• /)) {
      // Nested bullet points with indentation
      const match = line.match(/^(\s*)• (.+)/);
      if (match) {
        const indentLevel = Math.floor(match[1].length / 2); // 2 spaces per indent level
        const text = match[2];
        const indent = '\\li' + (720 + indentLevel * 360); // 720 twips base + 360 per level
        rtf += `\\par ${indent} \\bullet ${escapeRTF(text)}\\li0`;
      }
    } else if (line.match(/^(\s*)- /)) {
      // Nested bullet points with dashes and indentation
      const match = line.match(/^(\s*)- (.+)/);
      if (match) {
        const indentLevel = Math.floor(match[1].length / 2); // 2 spaces per indent level
        const text = match[2];
        const indent = '\\li' + (720 + indentLevel * 360); // 720 twips base + 360 per level
        rtf += `\\par ${indent} \\bullet ${escapeRTF(text)}\\li0`;
      }
    } else if (line.startsWith('1. ') || line.match(/^\d+\. /)) {
      // Numbered lists
      const text = line.replace(/^\d+\. /, '');
      rtf += `\\par ${escapeRTF(line.match(/^\d+/)?.[0] + '.')} ${escapeRTF(text)}`;
    } else if (line.trim() === '') {
      // Empty lines
      rtf += '\\par';
    } else {
      // Regular text
      rtf += `\\par ${escapeRTF(line)}`;
    }
  }
  
  rtf += '}';
  return rtf;
}

// Escape special RTF characters
function escapeRTF(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\par ');
}

// Unescape RTF content (convert \\par to \par, etc.)
function unescapeRTF(content: string): string {
  return content
    .replace(/\\\\/g, '\\')  // Convert double backslashes to single
    .replace(/\\{/g, '{')    // Convert escaped braces
    .replace(/\\}/g, '}');   // Convert escaped braces
}

// Copy content to clipboard using pbcopy
async function copyToClipboard(content: string): Promise<void> {
  try {
    // Check if content looks like escaped RTF and unescape it
    let processedContent = content;
    if (content.includes('\\\\rtf1') || content.includes('\\\\par')) {
      processedContent = unescapeRTF(content);
      console.log('📝 Unescaped RTF formatting for proper clipboard copying');
    }
    
    // Use pbcopy to copy RTF content to clipboard
    execSync('pbcopy', { input: processedContent });
  } catch (error) {
    console.warn('⚠️  Failed to copy to clipboard. Content saved to logs instead.');
    throw error;
  }
}

const program = new Command();

program
  .name('job-extractor')
  .description('Extract and score job information from job posting URLs using AI')
  .version('1.0.0');

program
  .command('extract')
  .description('Extract job information from URL, HTML, or JSON and automatically score it')
  .argument('<input>', 'URL of job posting, HTML content, or JSON object to extract/process')
  .option('-t, --type <type>', 'Input type: url, html, json, or jsonfile', 'url')
  .option('-o, --output <file>', 'Output file to save the extracted data (optional)')
  .option('-f, --format <format>', 'Output format: json or pretty', 'pretty')
  .option('-c, --criteria <file>', 'Path to criteria file for scoring', 'criteria.json')
  .option('--no-score', 'Skip automatic scoring after extraction')
  .option('--force-extract', 'Extract job even if competition is too high')
  .action(async (input: string, options) => {
    try {
      console.log('🔍 Extracting job information...');
      console.log(`📄 Input Type: ${options.type}`);
      console.log(`📄 Input: ${options.type === 'json' ? 'JSON data' : input.substring(0, 100)}...`);
      console.log('');

      const config = getConfig();
      const agent = new JobExtractorAgent(config);
      
      const result = await agent.extractFromInput(input, options.type, { ignoreCompetition: options.forceExtract });

      if (!result.success) {
        console.error('❌ Error:', result.error);
        process.exit(1);
      }

      if (!result.data) {
        console.error('❌ No data extracted');
        process.exit(1);
      }

      // Generate unique job ID using timestamp + random for guaranteed uniqueness
      const timestampHex = Date.now().toString(16);
      const random = Math.random().toString(16).substring(2, 6);
      const combined = timestampHex + random;
      const jobId = combined.substring(combined.length - 8);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create job-specific subdirectory
      const jobDir = path.join('logs', jobId);
      await fs.mkdir(jobDir, { recursive: true });
      
      const logFileName = `job-${timestamp}.json`;
      const logFilePath = path.join(jobDir, logFileName);

      // Save JSON to log file
      const jsonOutput = JSON.stringify(result.data, null, 2);
      await fs.writeFile(logFilePath, jsonOutput, 'utf-8');
      console.log(`✅ Job information logged to ${logFilePath}`);

      // Process job description with required terms extraction and index update
      await agent.processJobDescription(jobId, result.data.description);

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
          console.log(`  Required Skills: ${score.breakdown.required_skills}% - ${score.explanations.required_skills}`);
          console.log(`  Preferred Skills: ${score.breakdown.preferred_skills}% - ${score.explanations.preferred_skills}`);
          console.log(`  Experience Level: ${score.breakdown.experience_level}% - ${score.explanations.experience_level}`);
          console.log(`  Salary Match: ${score.breakdown.salary}% - ${score.explanations.salary}`);
          console.log(`  Location Match: ${score.breakdown.location}% - ${score.explanations.location}`);
          console.log(`  Company Match: ${score.breakdown.company_match}% - ${score.explanations.company_match}`);
          console.log('');
          console.log('💡 Rationale:');
          console.log(score.rationale);
          console.log('');
          console.log(jobId);
          
        } catch (scoreError) {
          console.log('⚠️  Scoring failed (extraction was successful):');
          console.log(`   ${scoreError instanceof Error ? scoreError.message : 'Unknown scoring error'}`);
          console.log('   You can manually score later with: job-extractor score ' + jobId);
          console.log('');
          console.log(jobId);
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
  .command('extract-description')
  .description('Extract job description from existing job JSON file to data subdirectory')
  .argument('<jobId>', 'Job ID to extract description for')
  .action(async (jobId: string) => {
    try {
      console.log('📄 Extracting job description...');
      console.log(`📊 Job ID: ${jobId}`);
      console.log('');

      const jobDir = path.join('logs', jobId);
      
      // Check if job directory exists
      try {
        await fs.access(jobDir);
      } catch {
        console.error(`❌ Job directory not found: ${jobDir}`);
        process.exit(1);
      }

      // Find the most recent job JSON file
      const files = await fs.readdir(jobDir);
      const jobFiles = files
        .filter(file => file.startsWith('job-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      if (jobFiles.length === 0) {
        console.error(`❌ No job JSON files found in ${jobDir}`);
        process.exit(1);
      }

      const jobFilePath = path.join(jobDir, jobFiles[0]);
      
      // Read and parse the job JSON file
      const jobDataRaw = await fs.readFile(jobFilePath, 'utf-8');
      const jobData = JSON.parse(jobDataRaw);

      if (!jobData.description) {
        console.error('❌ No description field found in job data');
        process.exit(1);
      }

      // Use JobExtractorAgent to process the description with required terms extraction
      const config = getConfig();
      const agent = new JobExtractorAgent(config);
      
      await agent.processJobDescription(jobId, jobData.description);
      
      console.log(`✅ Job description extracted from: ${jobFilePath}`);
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all job IDs (subdirectories under logs)')
  .option('-v, --verbose', 'Show additional details for each job')
  .action(async (options) => {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      
      // Check if logs directory exists
      try {
        await fs.access(logsDir);
      } catch {
        console.log('📁 No logs directory found - no jobs extracted yet');
        return;
      }

      // Read subdirectories
      const entries = await fs.readdir(logsDir, { withFileTypes: true });
      const jobIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();

      if (jobIds.length === 0) {
        console.log('📁 No job directories found in logs');
        return;
      }

      console.log(`📋 Found ${jobIds.length} job${jobIds.length === 1 ? '' : 's'}:`);
      console.log('=' .repeat(50));

      if (options.verbose) {
        // Show details for each job
        for (const jobId of jobIds) {
          const jobDir = path.join(logsDir, jobId);
          
          try {
            // Find job JSON file to get basic info
            const files = await fs.readdir(jobDir);
            const jobFiles = files
              .filter(file => file.startsWith('job-') && file.endsWith('.json'))
              .sort()
              .reverse(); // Most recent first

            if (jobFiles.length > 0) {
              const jobFilePath = path.join(jobDir, jobFiles[0]);
              const jobDataRaw = await fs.readFile(jobFilePath, 'utf-8');
              const jobData = JSON.parse(jobDataRaw);
              
              console.log(`\n📊 ${jobId}`);
              console.log(`   Company: ${jobData.company || 'Unknown'}`);
              console.log(`   Title: ${jobData.title || 'Unknown'}`);
              console.log(`   Location: ${jobData.location || 'Unknown'}`);
              if (jobData.salary) {
                const salaryStr = jobData.salary.min && jobData.salary.max 
                  ? `${jobData.salary.min} - ${jobData.salary.max} ${jobData.salary.currency || ''}`
                  : jobData.salary.min || jobData.salary.max || 'Not specified';
                console.log(`   Salary: ${salaryStr}`);
              }
              
              // Check what files exist
              const hasScore = files.some(f => f.startsWith('score-'));
              const hasResume = files.some(f => f.endsWith('.pdf'));
              const hasCritique = files.some(f => f.startsWith('critique-'));
              
              const status = [];
              if (hasScore) status.push('scored');
              if (hasResume) status.push('resume');
              if (hasCritique) status.push('critiqued');
              
              if (status.length > 0) {
                console.log(`   Status: ${status.join(', ')}`);
              }
            } else {
              console.log(`\n📊 ${jobId} (no job data found)`);
            }
          } catch (error) {
            console.log(`\n📊 ${jobId} (error reading job data)`);
          }
        }
      } else {
        // Simple list
        jobIds.forEach((jobId, index) => {
          console.log(`${index + 1}. ${jobId}`);
        });
      }

      console.log('');
      console.log('💡 Use --verbose (-v) flag for detailed information');
      console.log('💡 Use individual commands like "score <jobId>" or "resume <jobId> <cvFile>" to work with specific jobs');
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('create-job')
  .description('Create a new job ID and empty job JSON file for manual population')
  .option('-c, --company <company>', 'Company name (optional)')
  .option('-t, --title <title>', 'Job title (optional)')
  .option('-b, --blurb <blurb>', 'Relative path to a blurb file for job description synthesis (optional)')
  .option('-u, --url <url>', 'Company URL for gathering information (optional)')
  .action(async (options) => {
    try {
      console.log('📁 Creating new job entry...');
      if (options.company || options.title) {
        console.log(`🏢 Company: ${options.company || 'Not specified'}`);
        console.log(`📋 Title: ${options.title || 'Not specified'}`);
      }
      console.log('');

      const config = getConfig();
      const agent = new JobExtractorAgent(config);
      
      const result = await agent.createJob(options.company, options.title, options.blurb, options.url);
      
      console.log('✅ Job creation complete');
      console.log('=' .repeat(50));
      console.log(`📊 Job ID: ${result.jobId}`);
      console.log(`📄 File: ${result.filePath}`);
      console.log('');
      console.log('📝 Next steps:');
      console.log('1. Edit the JSON file to add job details');
      console.log(`2. Run: npm run dev extract-description ${result.jobId}`);
      console.log(`3. Run: npm run dev score ${result.jobId}`);
      console.log('');
      console.log('💡 Usage tip: Use -- to pass options correctly:');
      console.log('   npm run dev create-job -- --company "Company Name" --title "Job Title"');
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });


program
  .command('extract-for-eval')
  .description('Extract descriptions from all job directories to data/ and update index.jsonl')
  .action(async () => {
    try {
      console.log('🔄 Bulk extracting job descriptions for evaluation...');
      console.log('');

      const config = getConfig();
      const agent = new JobExtractorAgent(config);
      
      const results = await agent.extractForEval();
      
      console.log('');
      console.log('✅ Bulk extraction complete');
      console.log('=' .repeat(50));
      console.log(`📊 Summary:`);
      console.log(`   Processed: ${results.processed} jobs`);
      console.log(`   Skipped: ${results.skipped} jobs (already processed or no description)`);
      console.log(`   Errors: ${results.errors} jobs`);
      console.log('');
      
      if (results.processed > 0 || results.skipped > 0) {
        console.log(`📄 Job descriptions saved to: data/jd_*.txt`);
        console.log(`📋 Index updated in: data/index.jsonl`);
      }
      
      if (results.errors > 0) {
        console.log(`⚠️  ${results.errors} job(s) encountered errors during processing`);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

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
      console.log(`  Required Skills: ${score.breakdown.required_skills}% - ${score.explanations.required_skills}`);
      console.log(`  Preferred Skills: ${score.breakdown.preferred_skills}% - ${score.explanations.preferred_skills}`);
      console.log(`  Experience Level: ${score.breakdown.experience_level}% - ${score.explanations.experience_level}`);
      console.log(`  Salary Match: ${score.breakdown.salary}% - ${score.explanations.salary}`);
      console.log(`  Location Match: ${score.breakdown.location}% - ${score.explanations.location}`);
      console.log(`  Company Match: ${score.breakdown.company_match}% - ${score.explanations.company_match}`);
      console.log('');
      console.log('💡 Rationale:');
      console.log(score.rationale);
      console.log('');
      console.log(jobId);
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Generate a tailored resume PDF for a specific job')
  .argument('<jobId>', 'Job ID to tailor resume for (from the log filename)')
  .option('-o, --output <file>', 'Output path for the generated PDF')
  .option('--regen', 'Force regeneration of tailored content (skip cache)')
  .option('-m, --mode <mode>', 'Resume generation mode: "leader" (emphasizes management/strategy) or "builder" (emphasizes technical work)', 'leader')
  .option('--generate', 'Generate a detailed job description if missing or generic')
  .option('--company-url <url>', 'Company URL to use for generating job description context')
  .action(async (jobId: string, options) => {
    try {
      console.log('📄 Generating tailored resume...');
      console.log(`📊 Job ID: ${jobId}`);
      
      // Automatically find CV file
      const cvFile = await findCvFile();
      console.log(`📋 CV File: ${cvFile}`);
      console.log('');

      const anthropicConfig = getAnthropicConfig();
      
      // Validate mode option
      if (options.mode && !['leader', 'builder'].includes(options.mode)) {
        console.error('❌ Error: Mode must be either "leader" or "builder"');
        process.exit(1);
      }
      
      const mode = (options.mode || 'leader') as 'leader' | 'builder';
      console.log(`🎯 Resume Mode: ${mode} (${mode === 'leader' ? 'emphasizes management/strategy' : 'emphasizes technical work'})`);
      
      const creator = new ResumeCreatorAgent(anthropicConfig.anthropicApiKey, anthropicConfig.model, anthropicConfig.maxTokens, 4, mode);
      
      // Show generate mode if enabled
      if (options.generate) {
        console.log('🤖 Job description generation enabled');
        if (options.companyUrl) {
          console.log(`🌐 Using company URL: ${options.companyUrl}`);
        }
      }
      
      const generateParam = options.generate ? (options.companyUrl || true) : false;
      const result = await creator.createResume(jobId, cvFile, options.output, !!options.regen, generateParam);
      
      if (result.success) {
        console.log('✅ Resume Generation Complete');
        console.log('=' .repeat(50));
        console.log(`📄 PDF Generated: ${result.pdfPath}`);
        
        if (result.improvedWithCritique) {
          console.log('🎯 Resume automatically improved with critique feedback');
          if (result.critiqueRating) {
            console.log(`⭐ Initial Rating: ${result.critiqueRating}/10`);
          }
        }
        
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

program
  .command('critique')
  .description('Critique a tailored resume for a specific job')
  .argument('<jobId>', 'Job ID to critique resume for (from the log filename)')
  .action(async (jobId: string) => {
    try {
      console.log('🔍 Analyzing resume...');
      console.log(`📊 Job ID: ${jobId}`);
      console.log('');

      const anthropicConfig = getAnthropicConfig();
      const critic = new ResumeCriticAgent(
        anthropicConfig.anthropicApiKey,
        anthropicConfig.model,
        anthropicConfig.maxTokens
      );
      
      const result = await critic.critiqueResume(jobId);
      
      if (result.success) {
        console.log('✅ Resume Critique Complete');
        console.log('=' .repeat(50));
        console.log(`📄 Resume: ${result.resumePath}`);
        console.log(`⭐ Overall Rating: ${result.overallRating}/10`);
        console.log('');
        
        if (result.strengths && result.strengths.length > 0) {
          console.log('💪 Strengths:');
          result.strengths.forEach((strength, index) => {
            console.log(`  ${index + 1}. ${strength}`);
          });
          console.log('');
        }
        
        if (result.weaknesses && result.weaknesses.length > 0) {
          console.log('⚠️  Areas for Improvement:');
          result.weaknesses.forEach((weakness, index) => {
            console.log(`  ${index + 1}. ${weakness}`);
          });
          console.log('');
        }
        
        if (result.recommendations && result.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          result.recommendations.forEach((recommendation, index) => {
            console.log(`  ${index + 1}. ${recommendation}`);
          });
          console.log('');
        }
        
        if (result.detailedAnalysis) {
          console.log('📝 Detailed Analysis:');
          console.log(result.detailedAnalysis);
        }
      } else {
        console.error('❌ Resume critique failed:', result.error);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('prep')
  .description('Generate interview preparation materials (cover letter, endorsement, about me, general)')
  .argument('<type>', 'Type of statement: cover-letter, endorsement, about-me, general, themes, stories, profile, project, or list-projects')
  .argument('[jobId]', 'Job ID to generate statement for (not required for profile)')
  .argument('[projectNumber]', 'Project number to extract (for project type only)')
  .option('-e, --emphasis <text>', 'Special emphasis or instructions for the material')
  .option('-c, --company-info <text>', 'Additional company information (for about-me materials)')
  .option('-i, --instructions <text>', 'Custom instructions for the material')
  .option('--content', 'Output only the material content without formatting')
  .option('--regen', 'Force regenerate material (ignores cached content)')
  .action(async (type: string, jobId: string, projectNumber: string, options) => {
    try {
      // Handle themes extraction separately
      if (type === 'themes') {
        if (!jobId) {
          console.error('❌ Job ID is required for themes extraction');
          process.exit(1);
        }
        console.log('🎯 Extracting priority themes...');
        console.log(`📊 Job ID: ${jobId}`);
        console.log('');

        const config = getAnthropicConfig();
        const interviewPrepAgent = new InterviewPrepAgent(
          config.anthropicApiKey,
          config.model,
          config.maxTokens
        );

        const result = await interviewPrepAgent.extractThemes(jobId);

        if (result.success) {
          console.log('\n✅ Theme Extraction Complete');
        } else {
          console.error(`❌ Theme extraction failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Handle interview stories extraction
      if (type === 'stories') {
        if (!jobId) {
          console.error('❌ Job ID is required for stories extraction');
          process.exit(1);
        }
        console.log('📚 Extracting interview stories...');
        console.log(`📊 Job ID: ${jobId}`);
        console.log('');

        const config = getAnthropicConfig();
        const interviewPrepAgent = new InterviewPrepAgent(
          config.anthropicApiKey,
          config.model,
          config.maxTokens
        );

        const result = await interviewPrepAgent.getInterviewStories(jobId);

        if (result.success) {
          console.log('✅ Interview Stories Retrieved');
          console.log('=' .repeat(50));
          
          if (result.highlightedExamples && result.highlightedExamples.length > 0) {
            console.log('\n🌟 Highlighted Professional Impact Examples:');
            result.highlightedExamples.forEach((example, index) => {
              console.log(`\n${index + 1}. ${example.text}`);
              console.log(`   Source: ${example.source}`);
              console.log(`   Impact: ${example.impact}`);
            });
          }
          
          if (result.stories && result.stories.length > 0) {
            console.log('\n📖 Interview Story Suggestions:');
            result.stories.forEach((story, index) => {
              console.log(`\n${index + 1}. ${story}`);
            });
          }
          
          if ((!result.stories || result.stories.length === 0) && 
              (!result.highlightedExamples || result.highlightedExamples.length === 0)) {
            console.log('\n💡 No stories found. Run "prep about-me" first to generate interview stories.');
          }
        } else {
          console.error(`❌ Story extraction failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Handle profile generation
      if (type === 'profile') {
        console.log('👤 Generating profile and Google Apps Script...');
        console.log('');

        const config = getAnthropicConfig();
        const interviewPrepAgent = new InterviewPrepAgent(
          config.anthropicApiKey,
          config.model,
          config.maxTokens
        );

        const result = await interviewPrepAgent.createProfile();

        if (result.success) {
          console.log('✅ Profile Generation Complete');
          console.log('=' .repeat(50));
          console.log('\n📝 Generated Profile:');
          console.log(result.profile);
          console.log('\n📄 Google Apps Script generated and saved to logs/');
          console.log('💡 Copy the .js file content to Google Apps Script for use in Sheets');
        } else {
          console.error(`❌ Profile generation failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Handle project listing
      if (type === 'list-projects') {
        if (!jobId) {
          console.error('❌ Job ID is required for listing projects');
          process.exit(1);
        }
        console.log('📋 Listing available projects...');
        console.log(`📊 Job ID: ${jobId}`);
        console.log('');

        const config = getAnthropicConfig();
        const interviewPrepAgent = new InterviewPrepAgent(
          config.anthropicApiKey,
          config.model,
          config.maxTokens
        );

        const result = await interviewPrepAgent.listAvailableProjects(jobId);

        if (result.success) {
          console.log('✅ Available Projects');
          console.log('=' .repeat(50));
          console.log(`\n📊 Found ${result.count} projects:`);
          result.projects?.forEach(project => {
            console.log(`   ${project}`);
          });
          console.log('\n💡 Use: prep project <jobId> <projectNumber> to extract a specific project');
        } else {
          console.error(`❌ Project listing failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Handle project extraction
      if (type === 'project') {
        if (!jobId) {
          console.error('❌ Job ID is required for project extraction');
          process.exit(1);
        }
        
        // Parse project number
        let projectNum = 1;
        if (projectNumber) {
          projectNum = parseInt(projectNumber, 10);
        }
        
        if (isNaN(projectNum) || projectNum < 1) {
          console.error('❌ Invalid project number. Provide project number as: prep project <jobId> <projectNumber>');
          process.exit(1);
        }

        console.log('📋 Extracting project information...');
        console.log(`📊 Job ID: ${jobId}`);
        console.log(`🔢 Project: ${projectNum}`);
        console.log('');

        const config = getAnthropicConfig();
        const interviewPrepAgent = new InterviewPrepAgent(
          config.anthropicApiKey,
          config.model,
          config.maxTokens
        );

        const result = await interviewPrepAgent.extractProject(jobId, projectNum);

        if (result.success) {
          console.log('✅ Project Extraction Complete');
          console.log('=' .repeat(50));
          console.log('\n📋 Copy-Paste Ready Format:');
          console.log('=' .repeat(30));
          console.log(result.formattedOutput);
          console.log('=' .repeat(30));
          console.log('\n💡 Copy the above text and paste into your Catalant modal form');
        } else {
          console.error(`❌ Project extraction failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Validate material type for other types
      const validTypes: StatementType[] = ['cover-letter', 'endorsement', 'about-me', 'general', 'focus'];
      if (!validTypes.includes(type as StatementType)) {
        console.error(`❌ Invalid material type: ${type}`);
        console.error(`Valid types: ${validTypes.join(', ')}, themes, stories, profile, project, list-projects`);
        process.exit(1);
      }

      // Job ID is required for statement types
      if (!jobId) {
        console.error(`❌ Job ID is required for ${type} generation`);
        process.exit(1);
      }

      // Automatically find CV file for statement types
      const cvFile = await findCvFile();

      if (!options.content) {
        console.log('📝 Generating interview material...');
        console.log(`📊 Type: ${type}`);
        console.log(`📊 Job ID: ${jobId}`);
        console.log(`📋 CV File: ${cvFile}`);
      }

      const config = getAnthropicConfig();
      const interviewPrepAgent = new InterviewPrepAgent(
        config.anthropicApiKey,
        config.model,
        config.maxTokens
      );
      
      const materialOptions = {
        emphasis: options.emphasis,
        companyInfo: options.companyInfo,
        customInstructions: options.instructions
      };

      const result = await interviewPrepAgent.generateMaterial(
        type as StatementType,
        jobId,
        cvFile,
        materialOptions,
        !!options.regen, // Force regeneration if --regen flag is provided, otherwise use cache
        !!options.content // Content-only mode - find most recent statement file
      );

      if (result.success) {
        if (options.content) {
          // Just output the content without any formatting
          console.log(result.content);
        } else if (result.type === 'focus') {
          // Special handling for focus stories - copy RTF to clipboard
          console.log('✅ Focus Story Generation Complete');
          console.log('=' .repeat(50));
          console.log(`📝 Type: FOCUS STORY`);
          console.log(`📊 Character Count: ${result.characterCount}`);
          console.log('');
          
          // Copy RTF content directly to clipboard (LLM now generates RTF format)
          if (result.content) {
            await copyToClipboard(result.content);
          }
          
          console.log('📋 Focus story copied to clipboard in Rich Text Format');
          console.log('💡 Ready to paste into documents, emails, or notes');
        } else if (result.type === 'about-me') {
          // Special handling for about-me - copy RTF to clipboard
          console.log('✅ About Me Generation Complete');
          console.log('=' .repeat(50));
          console.log(`📝 Type: ABOUT ME`);
          console.log(`📊 Character Count: ${result.characterCount}`);
          console.log('');
          
          // Copy RTF content directly to clipboard (LLM now generates RTF format)
          if (result.content) {
            await copyToClipboard(result.content);
          }
          
          console.log('📋 About me content copied to clipboard in Rich Text Format');
          console.log('💡 Ready to paste into documents, emails, or notes');
        } else {
          console.log('✅ Interview Material Generation Complete');
          console.log('=' .repeat(50));
          console.log(`📝 Type: ${result.type.replace('-', ' ').toUpperCase()}`);
          console.log(`📊 Character Count: ${result.characterCount}`);
          console.log('');
          console.log('📄 Generated Material:');
          console.log(result.content);
        }
      } else {
        console.error(`❌ Interview material generation failed: ${result.error}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('outreach')
  .description('Find LinkedIn connections at target companies')
  .argument('<jobId>', 'Job ID to find connections for')
  .option('-a, --action <action>', 'Action: search (default) or list connections', 'search')
  .action(async (jobId: string, options) => {
    try {
      const outreachAgent = new OutreachAgent();
      const action = options.action;
      
      if (action === 'search') {
        console.log('🔍 Searching for LinkedIn connections...');
        console.log(`📊 Job ID: ${jobId}`);
        console.log('');
        
        const result = await outreachAgent.findConnections(jobId);
        
        if (result.success) {
          console.log('✅ LinkedIn Search Setup Complete');
          console.log('=' .repeat(50));
          console.log(`🏢 Company: ${result.company}`);
          console.log('📋 Follow the generated instructions to manually collect connection data');
          console.log('💡 Run "outreach list" after updating the connections template');
        } else {
          console.error(`❌ Outreach search failed: ${result.error}`);
          process.exit(1);
        }
      } else if (action === 'list') {
        console.log('📋 Loading LinkedIn connections...');
        console.log(`📊 Job ID: ${jobId}`);
        console.log('');
        
        const result = await outreachAgent.listConnections(jobId);
        
        if (result.success) {
          console.log('✅ LinkedIn Connections');
          console.log('=' .repeat(50));
          console.log(result.summary);
          
          if (result.connections && result.connections.length > 0) {
            console.log('\n📋 Connection Details:');
            console.log('-' .repeat(50));
            
            result.connections.forEach((connection, index) => {
              console.log(`\n${index + 1}. ${connection.name}`);
              console.log(`   Title: ${connection.title}`);
              console.log(`   Company: ${connection.company}`);
              console.log(`   Connection: ${connection.connectionDegree} degree`);
              if (connection.connectionDegree === '2nd' && connection.mutualConnection) {
                console.log(`   Through: ${connection.mutualConnection}`);
              }
              if (connection.location) {
                console.log(`   Location: ${connection.location}`);
              }
              console.log(`   Profile: ${connection.profileUrl}`);
            });
            
            console.log('\n💡 Use these connections for targeted outreach and networking');
          }
        } else {
          console.error(`❌ Failed to load connections: ${result.error}`);
          process.exit(1);
        }
      } else {
        console.error('❌ Invalid action. Use --action search or --action list');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('metrics')
  .description('Extract 90-day and first-year KPIs from job description')
  .argument('<jobId>', 'Job ID to extract metrics for')
  .action(async (jobId: string) => {
    try {
      console.log('📊 Extracting performance metrics...');
      console.log(`📊 Job ID: ${jobId}`);
      console.log('');

      const anthropicConfig = getAnthropicConfig();
      const metricsAgent = new MetricsAgent(
        anthropicConfig.anthropicApiKey,
        anthropicConfig.model,
        anthropicConfig.maxTokens
      );
      
      const result = await metricsAgent.extractMetrics(jobId);
      
      if (result.success) {
        console.log('✅ Metrics extraction complete');
        console.log(`📄 Results saved to logs/${jobId}/metrics-*.json`);
      } else {
        console.error(`❌ Metrics extraction failed: ${result.error}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Fill out job application form using resume and interview prep data')
  .argument('<jobId>', 'Job ID to use for resume and interview prep data')
  .argument('<applicationUrl>', 'URL of the job application form')
  .option('--dry-run', 'Open the form to inspect requirements without generating statements')
  .option('--skip', 'Skip automatic interview prep statement generation if missing')
  .action(async (jobId: string, applicationUrl: string, options: { dryRun?: boolean; skip?: boolean }) => {
    try {
      console.log('🎯 Starting job application process...');
      console.log(`📋 Application URL: ${applicationUrl}`);
      console.log(`📊 Job ID: ${jobId}`);
      console.log('');

      const openaiConfig = getConfig();
      const anthropicConfig = getAnthropicConfig();
      const applicationAgent = new ApplicationAgent(openaiConfig, anthropicConfig.anthropicApiKey);
      
      // Display mode information
      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE: Will open form to inspect requirements without generating statements');
        console.log('');
      } else if (options.skip) {
        console.log('⏭️  SKIP MODE: Will bypass automatic interview prep statement generation');
        console.log('');
      }

      const result = await applicationAgent.fillApplication(applicationUrl, jobId, {
        dryRun: options.dryRun || false,
        skipGeneration: options.skip || false
      });
      
      if (result.success) {
        console.log('\n✅ Application Form Analysis Complete');
        console.log('=' .repeat(80));
        console.log('🔍 Form has been parsed and fields have been filled');
        console.log('⚠️  IMPORTANT: Review all generated content before submitting!');
        console.log('');
        if (result.instructions) {
          console.log('📋 Next Steps:');
          console.log(result.instructions);
        }
        console.log('');
        console.log(`📄 Session logged to: logs/${jobId}/application-*.json`);
      } else {
        console.error(`❌ Application filling failed: ${result.error}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// WhoGotHired Agent Commands
program
  .command('whogothired')
  .description('Check Gmail rejections and track who got hired on LinkedIn')
  .action(async () => {
    try {
      console.log('🔍 Running WhoGotHired Agent...');
      
      const config = getConfig();
      const agent = new WhoGotHiredAgent(config);
      
      await agent.run();
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('whogothired:status')
  .description('Show WhoGotHired tracking status and statistics')
  .action(async () => {
    try {
      const config = getConfig();
      const agent = new WhoGotHiredAgent(config);
      
      await agent.status();
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('whogothired:check')
  .description('Force check LinkedIn for a specific company and job title')
  .argument('<company>', 'Company name to check')
  .argument('<jobTitle>', 'Job title to check')
  .action(async (company: string, jobTitle: string) => {
    try {
      console.log(`🔍 Force checking: ${company} - ${jobTitle}`);
      
      const config = getConfig();
      const agent = new WhoGotHiredAgent(config);
      
      await agent.forceCheck(company, jobTitle);
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('whogothired:list')
  .description('List all pending LinkedIn checks')
  .action(async () => {
    try {
      const config = getConfig();
      const agent = new WhoGotHiredAgent(config);
      
      await agent.listPendingChecks();
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('whogothired:report')
  .description('Report who got hired for a specific rejection')
  .argument('<rejectionId>', 'Rejection ID from the tracker')
  .argument('<name>', 'Name of the person who got hired')
  .argument('<title>', 'Job title of the hired person')
  .option('--linkedin <url>', 'LinkedIn URL of the hired person')
  .option('--start-date <date>', 'Start date of the hired person (YYYY-MM-DD)')
  .action(async (rejectionId: string, name: string, title: string, options: { linkedin?: string, startDate?: string }) => {
    try {
      console.log(`🎯 Reporting hire: ${name} for rejection ${rejectionId}`);
      
      const config = getConfig();
      const agent = new WhoGotHiredAgent(config);
      
      await agent.reportHire(rejectionId, name, title, options.linkedin, options.startDate);
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('whogothired:giveup')
  .description('Give up searching for who got hired for a specific rejection')
  .argument('<rejectionId>', 'Rejection ID from the tracker')
  .option('--reason <reason>', 'Reason for giving up (optional)')
  .action(async (rejectionId: string, options: { reason?: string }) => {
    try {
      console.log(`⏹️ Giving up search for rejection ${rejectionId}`);
      
      const config = getConfig();
      const agent = new WhoGotHiredAgent(config);
      
      await agent.giveUpSearch(rejectionId, options.reason);
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();