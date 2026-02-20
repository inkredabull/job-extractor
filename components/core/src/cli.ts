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
import { ModeDetectorAgent } from './agents/mode-detector-agent';
import { StatementType, AboutMeSection } from './types';
import { getConfig, getAnthropicConfig, getResumeGenerationConfig } from './config';
import { LLMProviderConfig } from './providers/llm-provider';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fss from 'fs';
import { execSync } from 'child_process';
import * as readline from 'readline';

// Helper function to find CV file automatically
async function findCvFile(): Promise<string> {
  // Try to find project root by looking for package.json with workspaces
  let projectRoot = process.cwd();
  try {
    // Walk up to find project root (contains package.json with workspaces)
    let currentDir = process.cwd();
    while (currentDir !== path.dirname(currentDir)) {
      const pkgPath = path.join(currentDir, 'package.json');
      if (fss.existsSync(pkgPath)) {
        const pkg = JSON.parse(fss.readFileSync(pkgPath, 'utf-8'));
        if (pkg.workspaces) {
          projectRoot = currentDir;
          break;
        }
      }
      currentDir = path.dirname(currentDir);
    }
  } catch {
    // If we can't find project root, use current directory
  }

  const possiblePaths = [
    // Try current directory first
    'cv.txt',
    './cv.txt',
    'CV.txt',
    './CV.txt',
    'sample-cv.txt',
    './sample-cv.txt',
    // Try project root
    path.join(projectRoot, 'cv.txt'),
    path.join(projectRoot, 'CV.txt'),
    path.join(projectRoot, 'sample-cv.txt'),
    // Try data directory in project root
    path.join(projectRoot, 'data', 'cv.txt'),
    path.join(projectRoot, 'data', 'CV.txt')
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

// Interactive about-me section management
async function interactiveAboutMeGeneration(jobId: string, options: any): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    const config = getAnthropicConfig();
    const interviewPrepAgent = new InterviewPrepAgent(
      config.anthropicApiKey,
      config.model,
      config.maxTokens
    );
    const cvFile = await findCvFile();

    const materialOptions = {
      emphasis: options.emphasis,
      companyInfo: options.companyInfo,
      customInstructions: options.instructions,
      person: options.person as 'first' | 'third'
    };

    const sectionNames: Record<AboutMeSection, string> = {
      'opener': 'Opener & Professional Summary',
      'focus-story': 'Focus Story (STAR)',
      'themes': 'Key Themes with Examples',
      'why': 'Why Company'
    };

    while (true) {
      console.log('\n' + '='.repeat(60));
      console.log('📝 About-Me Section Manager');
      console.log('='.repeat(60));
      console.log(`Job ID: ${jobId}`);
      console.log('');

      // Show section status
      const sections: AboutMeSection[] = ['opener', 'focus-story', 'themes', 'why'];
      console.log('Section Status:');
      for (const section of sections) {
        // Check if section exists
        const sectionData = interviewPrepAgent.loadSection(jobId, section);
        const status = sectionData ? '✅' : '❌';
        console.log(`  ${status} ${sectionNames[section]}`);
      }
      console.log('');

      console.log('Options:');
      console.log('  1. Generate all sections');
      console.log('  2. Generate specific section');
      console.log('  3. Regenerate specific section');
      console.log('  4. Critique specific section');
      console.log('  5. Refine section (edit and improve)');
      console.log('  6. View section content');
      console.log('  7. Combine sections into final output');
      console.log('  8. Exit');
      console.log('');

      const choice = await question('Select an option (1-8): ');

      if (choice === '1') {
        console.log('\n📝 Generating all sections...');
        const result = await interviewPrepAgent.generateMaterial(
          'about-me',
          jobId,
          cvFile,
          materialOptions,
          false,
          false
        );
        if (result.success) {
          console.log('✅ All sections generated successfully');
          if (result.content) {
            await copyToClipboard(result.content);
            console.log('📋 Combined content copied to clipboard');
          }
        } else {
          console.error(`❌ Generation failed: ${result.error}`);
        }
      } else if (choice === '2' || choice === '3') {
        console.log('\nSelect section to generate:');
        sections.forEach((section, index) => {
          console.log(`  ${index + 1}. ${sectionNames[section]}`);
        });
        const sectionChoice = await question('\nEnter section number: ');
        const sectionIndex = parseInt(sectionChoice) - 1;
        if (sectionIndex >= 0 && sectionIndex < sections.length) {
          const section = sections[sectionIndex];
          console.log(`\n📝 ${choice === '3' ? 'Regenerating' : 'Generating'} ${sectionNames[section]}...`);
          const result = await interviewPrepAgent.generateSection(
            section,
            jobId,
            cvFile,
            materialOptions,
            choice === '3'
          );
          if (result.success) {
            console.log(`✅ ${sectionNames[section]} ${choice === '3' ? 'regenerated' : 'generated'} successfully`);
          } else {
            console.error(`❌ Failed: ${result.error}`);
          }
        } else {
          console.error('❌ Invalid section number');
        }
      } else if (choice === '4') {
        console.log('\nSelect section to critique:');
        sections.forEach((section, index) => {
          console.log(`  ${index + 1}. ${sectionNames[section]}`);
        });
        const sectionChoice = await question('\nEnter section number: ');
        const sectionIndex = parseInt(sectionChoice) - 1;
        if (sectionIndex >= 0 && sectionIndex < sections.length) {
          const section = sections[sectionIndex];
          console.log(`\n🔍 Critiquing ${sectionNames[section]}...`);
          const result = await interviewPrepAgent.critiqueSection(jobId, section, cvFile);
          if (result.success) {
            console.log('\n' + '='.repeat(60));
            console.log(`📊 Critique: ${sectionNames[section]}`);
            console.log('='.repeat(60));
            if (result.rating) {
              console.log(`\n⭐ Rating: ${result.rating}/10`);
            }
            if (result.strengths && result.strengths.length > 0) {
              console.log('\n💪 Strengths:');
              result.strengths.forEach((s: string, i: number) => {
                console.log(`  ${i + 1}. ${s}`);
              });
            }
            if (result.weaknesses && result.weaknesses.length > 0) {
              console.log('\n⚠️  Weaknesses:');
              result.weaknesses.forEach((w: string, i: number) => {
                console.log(`  ${i + 1}. ${w}`);
              });
            }
            if (result.recommendations && result.recommendations.length > 0) {
              console.log('\n💡 Recommendations:');
              result.recommendations.forEach((r: string, i: number) => {
                console.log(`  ${i + 1}. ${r}`);
              });
            }
            if (result.detailedAnalysis) {
              console.log('\n📝 Detailed Analysis:');
              console.log(result.detailedAnalysis);
            }
          } else {
            console.error(`❌ Critique failed: ${result.error}`);
          }
        } else {
          console.error('❌ Invalid section number');
        }
      } else if (choice === '5') {
        console.log('\nSelect section to refine:');
        sections.forEach((section, index) => {
          console.log(`  ${index + 1}. ${sectionNames[section]}`);
        });
        const sectionChoice = await question('\nEnter section number: ');
        const sectionIndex = parseInt(sectionChoice) - 1;
        if (sectionIndex >= 0 && sectionIndex < sections.length) {
          const section = sections[sectionIndex];
          const sectionData = interviewPrepAgent.loadSection(jobId, section);
          if (!sectionData) {
            console.error(`❌ Section ${sectionNames[section]} not found. Generate it first.`);
          } else {
            console.log(`\n📝 Current ${sectionNames[section]} content:`);
            console.log('='.repeat(60));
            // Extract readable text from RTF for display
            const readableContent = sectionData.content.replace(/\\[a-z]+\d*\s?/gi, ' ').replace(/\{[^}]*\}/g, '').trim();
            console.log(readableContent.substring(0, 500) + (readableContent.length > 500 ? '...' : ''));
            console.log('='.repeat(60));
            console.log('\n💡 Edit the content above, then paste it here (or press Enter to skip):');
            const editedContent = await question('\nEdited content: ');
            if (editedContent.trim()) {
              console.log('\n🔧 Refining section...');
              const result = await (interviewPrepAgent as any).refineSection(jobId, section, editedContent, cvFile);
              if (result.success) {
                console.log(`✅ ${sectionNames[section]} refined successfully`);
              } else {
                console.error(`❌ Refinement failed: ${result.error}`);
              }
            }
          }
        } else {
          console.error('❌ Invalid section number');
        }
      } else if (choice === '6') {
        console.log('\nSelect section to view:');
        sections.forEach((section, index) => {
          console.log(`  ${index + 1}. ${sectionNames[section]}`);
        });
        const sectionChoice = await question('\nEnter section number: ');
        const sectionIndex = parseInt(sectionChoice) - 1;
        if (sectionIndex >= 0 && sectionIndex < sections.length) {
          const section = sections[sectionIndex];
          const sectionData = interviewPrepAgent.loadSection(jobId, section);
          if (sectionData) {
            console.log(`\n📄 ${sectionNames[section]}:`);
            console.log('='.repeat(60));
            console.log(sectionData.content);
            console.log('='.repeat(60));
          } else {
            console.error(`❌ Section ${sectionNames[section]} not found`);
          }
        } else {
          console.error('❌ Invalid section number');
        }
      } else if (choice === '7') {
        console.log('\n🔗 Combining sections...');
        try {
          const combined = await interviewPrepAgent.combineSections(jobId);
          await copyToClipboard(combined);
          console.log('✅ Sections combined and copied to clipboard');
        } catch (error) {
          console.error(`❌ Failed to combine: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (choice === '8') {
        console.log('\n👋 Exiting...');
        break;
      } else {
        console.error('❌ Invalid option');
      }
    }
  } finally {
    rl.close();
  }
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
  .option('--reminder-priority <priority>', 'Reminder priority for macOS reminders (1=High, 5=Medium, 9=Low)', '5')
  .option('--no-reminders', 'Skip creating macOS reminders (useful for preview/display purposes)')
  .option('--selected-reminders <reminders>', 'Comma-separated list of reminders to create: track,apply,ping,prep,followup')
  .option('--skip-post-workflow', 'Skip post-extraction workflow (scoring, resume generation)')
  .action(async (input: string, options) => {
    try {
      console.log('🔍 Extracting job information...');
      console.log(`📄 Input Type: ${options.type}`);
      console.log(`📄 Input: ${options.type === 'json' ? 'JSON data' : input.substring(0, 100)}...`);
      console.log('');

      const config = getConfig();
      const agent = new JobExtractorAgent(config);

      // Parse selected reminders if provided
      const selectedReminders: string[] | undefined = options.selectedReminders
        ? options.selectedReminders.split(',').map((r: string) => r.trim())
        : undefined;

      if (selectedReminders && selectedReminders.length > 0) {
        console.log(`📋 Selected reminders: ${selectedReminders.join(', ')}`);
      }

      const result = await agent.extractFromInput(input, options.type, {
        ignoreCompetition: options.forceExtract,
        reminderPriority: parseInt(options.reminderPriority) || 5,
        skipReminders: options.noReminders,
        skipPostWorkflow: options.skipPostWorkflow,
        selectedReminders: selectedReminders
      });

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

      // Automatically score the job unless --no-score or --skip-post-workflow is specified
      if (options.score !== false && !options.skipPostWorkflow) {
        console.log('');
        
        // Check if job already has a score >= 65
        try {
          const jobDir = path.resolve('logs', jobId);
          if (fss.existsSync(jobDir)) {
            const files = fss.readdirSync(jobDir);
            const scoreFiles = files.filter(f => f.startsWith('score-') && f.endsWith('.json'));
            
            if (scoreFiles.length > 0) {
              // Get the most recent score file
              const mostRecentScoreFile = scoreFiles.sort().reverse()[0];
              const scorePath = path.join(jobDir, mostRecentScoreFile);
              const scoreData = JSON.parse(fss.readFileSync(scorePath, 'utf-8'));
              
              if (scoreData.score >= 65) {
                console.log('📊 EXISTING SCORE DETECTED - SKIPPING AUTO-SCORING');
                console.log('=' .repeat(60));
                console.log(`🎯 Job already scored: ${scoreData.score}% (>= 65% threshold)`);
                console.log(`⏰ Score date: ${new Date(scoreData.timestamp).toLocaleString()}`);
                console.log('');
                console.log('💡 HIGH SCORE DETECTED - MANUAL REVIEW RECOMMENDED');
                console.log('   This job has a strong match score and should be manually reviewed');
                console.log('   for strategic application planning and customization.');
                console.log('');
                console.log('🔄 To re-score this job, use: npm run dev score ' + jobId);
                console.log('=' .repeat(60));
                console.log('');
                console.log(jobId);
                return;
              }
            }
          }
        } catch (scoreCheckError) {
          console.log('⚠️  Could not check existing score, proceeding with scoring...');
        }
        
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
          console.log('   You can manually score later with: npm run dev score ' + jobId);
          console.log('');
          console.log(jobId);
        }
      } else {
        // When post-workflow is skipped, still output the job ID for parsing
        console.log('');
        console.log(jobId);
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

// Helper function to load job data from logs
async function loadJobData(jobId: string) {
  const logsDir = path.join(process.cwd(), 'logs');
  const jobDir = path.join(logsDir, jobId);

  // Try to find job file in subdirectory first
  try {
    const files = await fs.readdir(jobDir);
    const jobFile = files.find(f => f.startsWith('job-') && f.endsWith('.json'));
    if (jobFile) {
      const content = await fs.readFile(path.join(jobDir, jobFile), 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Directory doesn't exist, try logs root
  }

  // Fallback: search logs root for matching job ID
  const files = await fs.readdir(logsDir);
  const jobFile = files.find(f => f.startsWith(`job-${jobId}`) && f.endsWith('.json'));
  if (jobFile) {
    const content = await fs.readFile(path.join(logsDir, jobFile), 'utf-8');
    return JSON.parse(content);
  }

  throw new Error(`Job data not found for job ID: ${jobId}`);
}

program
  .command('resume')
  .description('Generate a tailored resume PDF for a specific job')
  .argument('<jobId>', 'Job ID to tailor resume for (from the log filename)')
  .option('-o, --output <file>', 'Output path for the generated PDF')
  .option('--regen', 'Quick PDF rebuild from cached markdown (fast, no new content). Without this flag, generates fresh content using current prompts.')
  .option('-m, --mode <mode>', 'Resume generation mode: "leader" (emphasizes management/strategy) or "builder" (emphasizes technical work). If not specified, mode will be auto-detected from job description.')
  .option('--split', 'Use split experience format with Relevant and Related sections (default is standard single section)')
  .option('--provider <provider>', 'Override RESUME_LLM_PROVIDER for this run (anthropic or openai)')
  .option('--critique-provider <provider>', 'Override CRITIQUE_LLM_PROVIDER for this run (anthropic or openai)')
  .option('--model <model>', 'Override RESUME_LLM_MODEL for this run')
  .option('--critique-model <model>', 'Override CRITIQUE_LLM_MODEL for this run')
  .option('--generate', 'Generate a detailed job description if missing or generic')
  .option('--company-url <url>', 'Company URL to use for generating job description context')
  .option('--no-critique', 'Skip the automatic critique and improvement of the resume')
  .option('--skip-judge', 'Skip the PDF judge validation (one-page enforcement)')
  .action(async (jobId: string, options) => {
    try {
      const startTime = Date.now();

      console.log('📄 Generating tailored resume...');
      console.log(`📊 Job ID: ${jobId}`);

      // Automatically find CV file
      const cvFile = await findCvFile();
      console.log(`📋 CV File: ${cvFile}`);
      console.log('');

      // Load configuration
      let config;
      try {
        config = getResumeGenerationConfig();
      } catch (error) {
        if (error instanceof Error && error.message.includes('environment variable is required')) {
          console.error('\n❌ Configuration Error:\n');
          console.error(error.message);
          console.error('\nAdd these to your .env file:');
          console.error('  RESUME_LLM_PROVIDER=anthropic  # or "openai"');
          console.error('  RESUME_LLM_MODEL=claude-sonnet-4-5-20250929  # or "gpt-5.2-2025-12-11"');
          console.error('  CRITIQUE_LLM_PROVIDER=anthropic  # or "openai"');
          console.error('  CRITIQUE_LLM_MODEL=claude-sonnet-4-5-20250929  # or "gpt-5.2-2025-12-11"');
          console.error('  ANTHROPIC_API_KEY=your_key  # if using Anthropic');
          console.error('  OPENAI_API_KEY=your_key  # if using OpenAI\n');
          process.exit(1);
        }
        throw error;
      }

      // Apply CLI option overrides
      if (options.provider) {
        config.resumeProvider = options.provider as 'anthropic' | 'openai';
      }
      if (options.critiqueProvider) {
        config.critiqueProvider = options.critiqueProvider as 'anthropic' | 'openai';
      }
      if (options.model) {
        config.resumeModel = options.model;
      }
      if (options.critiqueModel) {
        config.critiqueModel = options.critiqueModel;
      }

      // Display configuration
      console.log('🔧 LLM Configuration:');
      console.log(`  Resume: ${config.resumeProvider} / ${config.resumeModel}`);
      console.log(`  Critique: ${config.critiqueProvider} / ${config.critiqueModel}`);
      console.log('');

      // Validate mode option
      if (options.mode && !['leader', 'builder'].includes(options.mode)) {
        console.error('❌ Error: Mode must be either "leader" or "builder"');
        process.exit(1);
      }

      let mode: 'leader' | 'builder';
      let modeSource: 'manual' | 'auto' = 'manual';

      // Auto-detect mode if not explicitly provided
      if (!options.mode) {
        try {
          console.log('🔍 Analyzing job description to determine optimal resume mode...');
          const jobData = await loadJobData(jobId);
          // ModeDetectorAgent still uses old API - get Anthropic config for now
          const anthropicConfig = getAnthropicConfig();
          const modeDetector = new ModeDetectorAgent(anthropicConfig.anthropicApiKey);
          const detection = await modeDetector.detectMode(jobData);

          mode = detection.mode;
          modeSource = 'auto';

          console.log(`✨ Auto-detected mode: ${mode} (confidence: ${detection.confidence}%)`);
          console.log(`📝 Reasoning: ${detection.reasoning}`);
          console.log('');
        } catch (error) {
          console.warn('⚠️  Mode detection failed, defaulting to leader mode');
          console.warn(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          mode = 'leader';
        }
      } else {
        mode = options.mode as 'leader' | 'builder';
      }

      const experienceFormat = options.split ? 'split' : 'standard';

      // Split format needs more roles (3-5 relevant + 2-3 related = 5-8 total)
      // Standard format typically uses 3-4 roles
      const maxRoles = options.split ? 7 : config.maxRoles;

      const modeLabel = modeSource === 'auto' ? '🤖 Auto-detected' : '👤 Manual';
      console.log(`🎯 Resume Mode: ${mode} (${modeLabel}) - ${mode === 'leader' ? 'emphasizes management/strategy' : 'emphasizes technical work'}`);
      if (options.split) {
        console.log(`📊 Experience Format: split (Relevant vs Related sections, using ${maxRoles} roles)`);
      }

      // Create provider configurations
      const resumeProviderConfig: LLMProviderConfig = {
        provider: config.resumeProvider,
        apiKey: config.resumeApiKey,
        model: config.resumeModel,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      };

      const critiqueProviderConfig: LLMProviderConfig = {
        provider: config.critiqueProvider,
        apiKey: config.critiqueApiKey,
        model: config.critiqueModel,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      };

      const creator = new ResumeCreatorAgent(
        resumeProviderConfig,
        critiqueProviderConfig,
        maxRoles,
        mode,
        experienceFormat
      );

      // Show generate mode if enabled
      if (options.generate) {
        console.log('🤖 Job description generation enabled');
        if (options.companyUrl) {
          console.log(`🌐 Using company URL: ${options.companyUrl}`);
        }
      }

      const generateParam = options.generate ? (options.companyUrl || true) : false;

      // When --regen is used, force critique to false since we're just rebuilding PDF
      // Also skip judge validation when regenerating from existing markdown
      const critiqueFlag = options.regen ? false : !options.noCritique;
      const skipJudgeFlag = options.regen ? true : !!options.skipJudge;

      const result = await creator.createResume(
        jobId,
        cvFile,
        options.output,
        !!options.regen,
        generateParam,
        critiqueFlag,
        'cli',  // Indicate this is called from CLI
        skipJudgeFlag
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.success) {
        console.log('✅ Resume Generation Complete');
        console.log('=' .repeat(50));
        console.log(`📄 PDF Generated: ${result.pdfPath}`);
        console.log(`⏱️  Duration: ${duration}s`);
        if (result.totalCost !== undefined) {
          console.log(`💰 Total Cost: $${result.totalCost.toFixed(4)}`);
        }

        if (result.improvedWithCritique) {
          console.log('🎯 Resume automatically improved with critique feedback');
          if (result.critiqueRating) {
            console.log(`⭐ Initial Rating: ${result.critiqueRating}/10`);
          }
        }

        // Only show tailoring changes if not using --regen (since regen just uses cached content)
        if (!options.regen && result.tailoringChanges && result.tailoringChanges.length > 0) {
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

      const config = getResumeGenerationConfig();

      console.log('🔧 LLM Configuration:');
      console.log(`  Critique: ${config.critiqueProvider} / ${config.critiqueModel}`);
      console.log('');

      const critiqueProviderConfig: LLMProviderConfig = {
        provider: config.critiqueProvider,
        apiKey: config.critiqueApiKey,
        model: config.critiqueModel,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      };

      const { ProviderFactory } = await import('./providers/provider-factory');
      const critiqueProvider = ProviderFactory.create(critiqueProviderConfig);
      const critic = new ResumeCriticAgent(critiqueProvider);
      
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
  .description('Generate interview preparation materials (cover letter, endorsement, interview, general)')
  .argument('<type>', 'Type of statement: cover-letter, endorsement, interview, about-me, general, themes, stories, profile, project, or list-projects')
  .argument('[jobId]', 'Job ID to generate statement for (not required for profile)')
  .argument('[projectNumber]', 'Project number to extract (for project type only)')
  .option('-e, --emphasis <text>', 'Special emphasis or instructions for the material')
  .option('-c, --company-info <text>', 'Additional company information (for about-me materials)')
  .option('-i, --instructions <text>', 'Custom instructions for the material')
  .option('-p, --person <person>', 'Writing perspective: first (I/me) or third (he/Anthony)', 'first')
  .option('--company-url <url>', 'Company website URL for company values research (skips interactive prompt)')
  .option('--content', 'Output only the material content without formatting')
  .option('--regen', 'Force regenerate material (ignores cached content)')
  .option('--interactive', 'Interactive mode for about-me: select sections to generate, critique, or refine')
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

      // Handle interview command (merges about-me and focus)
      if (type === 'interview') {
        if (!jobId) {
          console.error('❌ Job ID is required for interview generation');
          process.exit(1);
        }
        
        const cvFile = await findCvFile();
        
        if (!options.content) {
          console.log('🎙️ Generating comprehensive interview preparation...');
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

        const result = await interviewPrepAgent.generateInterviewPrep(
          jobId,
          cvFile,
          materialOptions,
          !!options.regen,
          !!options.content
        );

        if (result.success) {
          if (options.content) {
            console.log(result.aboutMeContent || '');
          } else {
            console.log('✅ Interview Preparation Complete');
            console.log('=' .repeat(50));
            
            // Copy content to clipboard
            if (result.aboutMeContent) {
              await copyToClipboard(result.aboutMeContent);
              console.log('📋 Comprehensive interview content copied to clipboard in Rich Text Format');
              console.log('    • Professional Summary (3-5 bullet points)');
              console.log('    • Focus Story (STAR method)');
              console.log('    • Key Themes with examples');
              console.log(`    • Why ${jobId.substring(0,8)}... company fit`);
            }
            
            if (result.companyRubricGenerated) {
              console.log('📊 Company evaluation rubric generated: company-rubric.txt');
            }
            
            console.log('💡 Ready to paste into documents, emails, or notes');
          }
        } else {
          console.error(`❌ Interview preparation failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Validate material type for other types
      const validTypes: StatementType[] = ['cover-letter', 'endorsement', 'about-me', 'general'];
      if (!validTypes.includes(type as StatementType)) {
        console.error(`❌ Invalid material type: ${type}`);
        console.error(`Valid types: ${validTypes.join(', ')}, interview, themes, stories, profile, project, list-projects`);
        process.exit(1);
      }

      // Job ID is required for statement types
      if (!jobId) {
        console.error(`❌ Job ID is required for ${type} generation`);
        process.exit(1);
      }

      // Handle interactive mode for about-me
      if (type === 'about-me' && options.interactive) {
        await interactiveAboutMeGeneration(jobId, options);
        return;
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
      
      // Validate person option
      if (options.person && !['first', 'third'].includes(options.person)) {
        console.error(`❌ Invalid person option: ${options.person}`);
        console.error('Valid options: first, third');
        process.exit(1);
      }

      const materialOptions = {
        emphasis: options.emphasis,
        companyInfo: options.companyInfo,
        customInstructions: options.instructions,
        person: options.person as 'first' | 'third',
        companyUrl: options.companyUrl
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
        } else if (result.type === 'about-me') {
          // Special handling for about-me - copy RTF to clipboard
          console.log('✅ About Me Generation Complete (with Focus Story)');
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
      const applicationAgent = new ApplicationAgent(openaiConfig, anthropicConfig.anthropicApiKey, anthropicConfig.maxRoles);
      
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

program
  .command('reminder')
  .description('Create a local macOS reminder')
  .option('--title <title>', 'Reminder title (required)')
  .option('--notes <notes>', 'Reminder notes/description')
  .option('--priority <priority>', 'Priority (1=High, 5=Medium, 9=Low)', '5')
  .option('--list <list>', 'Reminder list name', 'Reminders')
  .option('--due <date>', 'Due date (YYYY-MM-DD format)')
  .action(async (options) => {
    try {
      if (!options.title) {
        console.error('❌ Error: --title is required');
        process.exit(1);
      }

      console.log('📝 Creating macOS reminder...');
      console.log(`📌 Title: ${options.title}`);
      console.log(`📋 List: ${options.list}`);
      console.log(`⭐ Priority: ${options.priority}`);

      if (options.notes) {
        console.log(`📄 Notes: ${options.notes.substring(0, 100)}${options.notes.length > 100 ? '...' : ''}`);
      }

      // Import MacOSReminderService dynamically
      // @ts-ignore - Optional dependency, may not be available
      const { MacOSReminderService } = await import('@inkredabull/macos-reminder');
      
      const reminderService = new MacOSReminderService();
      
      const reminderData: any = {
        title: options.title,
        priority: parseInt(options.priority) || 5,
        list: options.list
      };
      
      if (options.notes) {
        reminderData.notes = options.notes;
      }
      
      if (options.due) {
        reminderData.dueDate = options.due; // Keep as string format
      }

      await reminderService.createReminder(reminderData);
      
      console.log('✅ Reminder created successfully!');
      
    } catch (error) {
      console.error('❌ Error creating reminder:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Individual section commands for granular about-me management
const sectionCommands: Record<string, AboutMeSection> = {
  'about-me-opener': 'opener',
  'about-me-focus-story': 'focus-story',
  'about-me-themes': 'themes',
  'about-me-why': 'why'
};

for (const [commandName, section] of Object.entries(sectionCommands)) {
  program
    .command(commandName)
    .description(`Generate or manage the ${section} section of about-me statement`)
    .argument('<jobId>', 'Job ID to generate section for')
    .option('-e, --emphasis <text>', 'Special emphasis or instructions')
    .option('-c, --company-info <text>', 'Additional company information')
    .option('-i, --instructions <text>', 'Custom instructions')
    .option('--regen', 'Force regenerate section')
    .option('--critique', 'Critique the section')
    .option('--view', 'View the section content')
    .action(async (jobId: string, options) => {
      try {
        const cvFile = await findCvFile();
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

        if (options.view) {
          const sectionData = interviewPrepAgent.loadSection(jobId, section);
          if (sectionData) {
            console.log(`\n📄 ${section} Section:`);
            console.log('='.repeat(60));
            console.log(sectionData.content);
            console.log('='.repeat(60));
          } else {
            console.error(`❌ Section ${section} not found. Generate it first.`);
            process.exit(1);
          }
        } else if (options.critique) {
          console.log(`\n🔍 Critiquing ${section} section...`);
          const result = await interviewPrepAgent.critiqueSection(jobId, section, cvFile);
          if (result.success) {
            console.log('\n' + '='.repeat(60));
            console.log(`📊 Critique: ${section}`);
            console.log('='.repeat(60));
            if (result.rating) {
              console.log(`\n⭐ Rating: ${result.rating}/10`);
            }
            if (result.strengths && result.strengths.length > 0) {
              console.log('\n💪 Strengths:');
              result.strengths.forEach((s: string, i: number) => {
                console.log(`  ${i + 1}. ${s}`);
              });
            }
            if (result.weaknesses && result.weaknesses.length > 0) {
              console.log('\n⚠️  Weaknesses:');
              result.weaknesses.forEach((w: string, i: number) => {
                console.log(`  ${i + 1}. ${w}`);
              });
            }
            if (result.recommendations && result.recommendations.length > 0) {
              console.log('\n💡 Recommendations:');
              result.recommendations.forEach((r: string, i: number) => {
                console.log(`  ${i + 1}. ${r}`);
              });
            }
            if (result.detailedAnalysis) {
              console.log('\n📝 Detailed Analysis:');
              console.log(result.detailedAnalysis);
            }
          } else {
            console.error(`❌ Critique failed: ${result.error}`);
            process.exit(1);
          }
        } else {
          console.log(`📝 Generating ${section} section...`);
          const result = await interviewPrepAgent.generateSection(
            section,
            jobId,
            cvFile,
            materialOptions,
            !!options.regen
          );
          if (result.success) {
            console.log(`✅ ${section} section generated successfully`);
            if (result.content) {
              await copyToClipboard(result.content);
              console.log('📋 Section content copied to clipboard');
            }
          } else {
            console.error(`❌ Generation failed: ${result.error}`);
            process.exit(1);
          }
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}

program.parse();