#!/usr/bin/env node

import { Command } from 'commander';
import { JobExtractorAgent } from './agents/job-extractor-agent';
import { JobScorerAgent } from './agents/job-scorer-agent';
import { ResumeCreatorAgent } from './agents/resume-creator-agent';
import { ResumeCriticAgent } from './agents/resume-critic-agent';
import { InterviewPrepAgent } from './agents/interview-prep-agent';
import { OutreachAgent } from './agents/outreach-agent';
import { StatementType } from './types';
import { getConfig, getAnthropicConfig } from './config';
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
      
      const result = await agent.createJob(options.company, options.title);
      
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
  .option('--regen', 'Force regeneration of tailored content (skip cache)')
  .action(async (jobId: string, cvFile: string, options) => {
    try {
      console.log('📄 Generating tailored resume...');
      console.log(`📊 Job ID: ${jobId}`);
      console.log(`📋 CV File: ${cvFile}`);
      console.log('');

      const anthropicConfig = getAnthropicConfig();
      const creator = new ResumeCreatorAgent(anthropicConfig.anthropicApiKey, anthropicConfig.model, anthropicConfig.maxTokens);
      
      const result = await creator.createResume(jobId, cvFile, options.output, !!options.regen);
      
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
  .argument('[cvFile]', 'Path to CV file (not required for themes extraction)')
  .argument('[projectNumber]', 'Project number to extract (for project type only)')
  .option('-e, --emphasis <text>', 'Special emphasis or instructions for the material')
  .option('-c, --company-info <text>', 'Additional company information (for about-me materials)')
  .option('-i, --instructions <text>', 'Custom instructions for the material')
  .option('--content', 'Output only the material content without formatting')
  .option('--regen', 'Force regenerate material (ignores cached content)')
  .action(async (type: string, jobId: string, cvFile: string, projectNumber: string, options) => {
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
        
        // For project extraction, if cvFile is a number and projectNumber is undefined,
        // then cvFile is actually the project number
        let projectNum = 1;
        if (projectNumber) {
          projectNum = parseInt(projectNumber, 10);
        } else if (cvFile && !isNaN(parseInt(cvFile, 10))) {
          // cvFile is actually the project number
          projectNum = parseInt(cvFile, 10);
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
      const validTypes: StatementType[] = ['cover-letter', 'endorsement', 'about-me', 'general'];
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

      // CV file is required for statement types
      if (!cvFile) {
        console.error(`❌ CV file is required for ${type} generation`);
        process.exit(1);
      }

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
  .argument('<action>', 'Action: search, list')
  .argument('<jobId>', 'Job ID to find connections for')
  .action(async (action: string, jobId: string) => {
    try {
      const outreachAgent = new OutreachAgent();
      
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
        console.error('❌ Invalid action. Use: search or list');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();