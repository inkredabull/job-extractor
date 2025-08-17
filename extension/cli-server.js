#!/usr/bin/env node

// Simple CLI server for the Chrome extension to execute extract commands
const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Enable CORS for extension
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CLI server is running' });
});

// Extract endpoint
app.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    
    console.log(`CLI Server: Extracting job from URL: ${url}`);
    
    // Change to the main project directory
    const projectDir = path.resolve(__dirname, '..');
    process.chdir(projectDir);
    
    // Execute the extract command
    const command = `npm run dev extract "${url}"`;
    console.log(`CLI Server: Executing command: ${command}`);
    
    const output = execSync(command, { 
      encoding: 'utf-8',
      timeout: 60000, // 60 second timeout
      cwd: projectDir
    });
    
    console.log(`CLI Server: Command output: ${output}`);
    
    // Parse the output to extract job ID and other information
    const jobIdMatch = output.match(/([a-f0-9]{8})\s*$/m);
    const jobId = jobIdMatch ? jobIdMatch[1] : null;
    
    if (!jobId) {
      return res.status(500).json({
        success: false,
        error: 'Could not extract job ID from command output'
      });
    }
    
    // Try to read the job file to get job data
    let jobData = null;
    try {
      const jobDir = path.join(projectDir, 'logs', jobId);
      const files = fs.readdirSync(jobDir);
      const jobFile = files.find(file => file.startsWith('job-') && file.endsWith('.json'));
      
      if (jobFile) {
        const jobFilePath = path.join(jobDir, jobFile);
        const jobDataRaw = fs.readFileSync(jobFilePath, 'utf-8');
        jobData = JSON.parse(jobDataRaw);
      }
    } catch (error) {
      console.log('CLI Server: Could not read job data:', error.message);
    }
    
    res.json({
      success: true,
      jobId: jobId,
      filePath: `logs/${jobId}/`,
      jobData: jobData
    });
    
  } catch (error) {
    console.error('CLI Server: Extract failed:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('TIMEOUT')) {
      errorMessage = 'Extraction timed out - this job site may take longer to process';
    } else if (error.message.includes('competition')) {
      errorMessage = 'Job skipped due to high competition (too many applicants)';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Job Extractor CLI Server running on http://localhost:${PORT}`);
  console.log('Ready to accept extract requests from Chrome extension');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('CLI Server: Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('CLI Server: Received SIGINT, shutting down gracefully');
  process.exit(0);
});