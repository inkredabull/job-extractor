#!/usr/bin/env node

import { Command } from 'commander';
import { JobExtractorAgent } from './agents/job-extractor-agent';
import { getConfig } from './config';

const program = new Command();

program
  .name('job-extractor')
  .description('Extract job information from job posting URLs using AI')
  .version('1.0.0');

program
  .command('extract')
  .description('Extract job information from a URL')
  .argument('<url>', 'URL of the job posting to extract')
  .option('-o, --output <file>', 'Output file to save the extracted data (optional)')
  .option('-f, --format <format>', 'Output format: json or pretty', 'pretty')
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

      // Format output
      let output: string;
      if (options.format === 'json') {
        output = JSON.stringify(result.data, null, 2);
      } else {
        output = formatPrettyOutput(result.data);
      }

      // Output to file or console
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(`✅ Job information saved to ${options.output}`);
      } else {
        console.log(output);
      }

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

function formatPrettyOutput(data: any): string {
  let output = '';
  output += '✅ Job Information Extracted:\n';
  output += '=' .repeat(50) + '\n\n';
  output += `📋 Title: ${data.title}\n`;
  output += `🏢 Company: ${data.company}\n`;
  output += `📍 Location: ${data.location}\n`;
  
  if (data.salary) {
    output += `💰 Salary: `;
    if (data.salary.min && data.salary.max) {
      output += `${data.salary.min} - ${data.salary.max} ${data.salary.currency}\n`;
    } else if (data.salary.min) {
      output += `${data.salary.min} ${data.salary.currency}\n`;
    } else if (data.salary.max) {
      output += `Up to ${data.salary.max} ${data.salary.currency}\n`;
    }
  }
  
  output += '\n📝 Description:\n';
  output += '-' .repeat(20) + '\n';
  output += data.description + '\n';
  
  return output;
}

program.parse();