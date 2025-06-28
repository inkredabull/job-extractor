#!/usr/bin/env node

import { Command } from 'commander';
import { JobExtractorAgent } from './agents/job-extractor-agent';
import { JobScorerAgent } from './agents/job-scorer-agent';
import { ResumeCreatorAgent } from './agents/resume-creator-agent';
import { ResumeCriticAgent } from './agents/resume-critic-agent';
import { InterviewPrepAgent } from './agents/interview-prep-agent';
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
  .argument('<type>', 'Type of statement: cover-letter, endorsement, about-me, general, themes, or stories')
  .argument('<jobId>', 'Job ID to generate statement for')
  .argument('[cvFile]', 'Path to CV file (not required for themes extraction)')
  .option('-e, --emphasis <text>', 'Special emphasis or instructions for the material')
  .option('-c, --company-info <text>', 'Additional company information (for about-me materials)')
  .option('-i, --instructions <text>', 'Custom instructions for the material')
  .option('--content', 'Output only the material content without formatting')
  .option('--regen', 'Force regenerate material (ignores cached content)')
  .action(async (type: string, jobId: string, cvFile: string, options) => {
    try {
      // Handle themes extraction separately
      if (type === 'themes') {
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

      // Validate material type for other types
      const validTypes: StatementType[] = ['cover-letter', 'endorsement', 'about-me', 'general'];
      if (!validTypes.includes(type as StatementType)) {
        console.error(`❌ Invalid material type: ${type}`);
        console.error(`Valid types: ${validTypes.join(', ')}, themes, stories`);
        process.exit(1);
      }

      // CV file is required for non-themes/stories types
      if (!cvFile && type !== 'stories') {
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

program.parse();