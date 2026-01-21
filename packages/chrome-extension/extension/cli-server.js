#!/usr/bin/env node

// Simple CLI server for the Chrome extension to execute extract commands
const express = require('express');
const cors = require('cors');
const { execSync, spawn } = require('child_process');
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
    const { url, type, data } = req.body;
    
    // Handle different extraction types
    if (type === 'json') {
      // Handle JSON extraction
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Job data is required for JSON extraction'
        });
      }
      
      console.log(`CLI Server: Processing JSON data:`, data);
      
      // Change to the main project directory
      const projectDir = path.resolve(__dirname, '..');
      process.chdir(projectDir);
      
      // Create a temporary JSON file with the job data
      const tempJsonFile = path.join(projectDir, 'temp-job-extract.json');
      fs.writeFileSync(tempJsonFile, JSON.stringify(data, null, 2));
      
      try {
        // Execute the extract command using the temp file path
        console.log(`CLI Server: Executing extract with JSON file: ${tempJsonFile}`);
        
        const output = await new Promise((resolve, reject) => {
          const child = spawn('npx', ['ts-node', 'packages/core/src/cli.ts', 'extract', '--type', 'jsonfile', tempJsonFile], {
            cwd: projectDir,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', (data) => {
            stdout += data;
          });
          
          child.stderr.on('data', (data) => {
            stderr += data;
          });
          
          child.on('close', (code) => {
            console.log(`CLI Server: Command finished with code ${code}`);
            console.log(`CLI Server: STDOUT: ${stdout}`);
            console.log(`CLI Server: STDERR: ${stderr}`);
            
            if (code === 0) {
              resolve(stdout);
            } else {
              reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
          });
          
          // Set timeout
          setTimeout(() => {
            child.kill();
            reject(new Error('Command timed out after 30 seconds'));
          }, 30000);
        });
        
        console.log(`CLI Server: Command output: ${output}`);
        
        // Parse the output to extract job ID
        const jobIdMatch = output.match(/([a-f0-9]{8})\s*$/m);
        const jobId = jobIdMatch ? jobIdMatch[1] : null;
        
        if (!jobId) {
          return res.status(500).json({
            success: false,
            error: 'Could not extract job ID from command output'
          });
        }
        
        // Try to read the job file to get processed job data
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
          console.log('CLI Server: Could not read processed job data:', error.message);
        }
        
        res.json({
          success: true,
          jobId: jobId,
          filePath: `logs/${jobId}/`,
          jobData: jobData || data // Return original data if processed data not available
        });
        
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempJsonFile);
        } catch (cleanupError) {
          console.log('CLI Server: Could not clean up temp JSON file:', cleanupError.message);
        }
      }
      
    } else {
      // Handle URL extraction (existing behavior)
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required for URL extraction'
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
    }
    
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

// Teal tracking endpoint
app.post('/teal-track', async (req, res) => {
  try {
    const { jobInfo } = req.body;
    
    if (!jobInfo) {
      return res.status(400).json({
        success: false,
        error: 'Job info is required'
      });
    }
    
    console.log(`CLI Server: Tracking job in Teal:`, jobInfo);
    
    // Change to the main project directory
    const projectDir = path.resolve(__dirname, '..');
    process.chdir(projectDir);
    
    // Create a temporary file with job data for the CLI command
    const tempJobFile = path.join(projectDir, 'temp-job-data.json');
    fs.writeFileSync(tempJobFile, JSON.stringify(jobInfo, null, 2));
    
    try {
      // Note: Teal automation now handled by Chrome extension, not CLI
      console.log(`CLI Server: Teal automation request received but deprecated`);
      
      res.json({
        success: false,
        error: 'Teal automation is now handled by the Chrome extension. Use the Track button in the extension panel.'
      });
      
    } finally {
      // Clean up temporary file
      try {
        fs.unlinkSync(tempJobFile);
      } catch (cleanupError) {
        console.log('CLI Server: Could not clean up temp file:', cleanupError.message);
      }
    }
    
  } catch (error) {
    console.error('CLI Server: Teal tracking failed:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('TIMEOUT')) {
      errorMessage = 'Teal automation timed out - browser automation may take longer';
    } else if (error.message.includes('navigation')) {
      errorMessage = 'Could not navigate to Teal - check your internet connection';
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