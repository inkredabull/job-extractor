import { ResumeCreatorAgent } from './src/agents/resume-creator-agent';
import { getAnthropicConfig } from './src/config';
import * as path from 'path';
import * as fs from 'fs';

async function testResumePrompt() {
  try {
    const jobId = '2f2f18c8';
    const outputDir = path.join(process.cwd(), 'logs', jobId);
    
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const config = getAnthropicConfig();
    const creator = new ResumeCreatorAgent(
      config.anthropicApiKey,
      config.model,
      config.maxTokens,
      config.maxRoles,
      'leader' // mode
    );
    
    // Find CV file
    const cvFile = await findCvFile();
    console.log(`Using CV file: ${cvFile}`);
    
    // Generate resume
    await creator.createResume(jobId, cvFile, undefined, true, false, true);
    console.log('Resume generation complete');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Helper function to find CV file
async function findCvFile() {
  const possiblePaths = [
    path.join(process.env.HOME || '', 'Google Drive', 'My Drive', 'Professional', 'Resume', 'CV.pdf'),
    path.join(process.env.HOME || '', 'Resume', 'CV.pdf'),
    path.join(process.cwd(), 'CV.pdf')
  ];
  
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  
  throw new Error('Could not find CV file. Please place your CV as CV.pdf in one of the standard locations.');
}

testResumePrompt();
