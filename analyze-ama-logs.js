#!/usr/bin/env node

// AMA Chat Log Analyzer for Quality Assurance
const fs = require('fs');
const path = require('path');

function analyzeAMALogs() {
  const logsDir = path.join(__dirname, 'logs', 'ama-chats');
  
  if (!fs.existsSync(logsDir)) {
    console.log('No AMA chat logs found. Directory:', logsDir);
    return;
  }
  
  const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.jsonl'));
  
  if (logFiles.length === 0) {
    console.log('No chat log files found in:', logsDir);
    return;
  }
  
  console.log('🔍 AMA Chat Log Analysis');
  console.log('=' .repeat(50));
  
  let totalChats = 0;
  let totalSessions = new Set();
  let questionTypes = {};
  let responseLength = [];
  let dailyStats = {};
  
  logFiles.forEach(file => {
    const filePath = path.join(logsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    console.log(`\n📁 ${file} (${lines.length} chats)`);
    
    lines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        totalChats++;
        totalSessions.add(entry.sessionId);
        
        // Track daily stats
        const date = entry.timestamp.split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { chats: 0, sessions: new Set() };
        }
        dailyStats[date].chats++;
        dailyStats[date].sessions.add(entry.sessionId);
        
        // Analyze question types
        const question = entry.question.toLowerCase();
        if (question.includes('experience') || question.includes('work')) {
          questionTypes.experience = (questionTypes.experience || 0) + 1;
        } else if (question.includes('skill') || question.includes('technical')) {
          questionTypes.skills = (questionTypes.skills || 0) + 1;
        } else if (question.includes('leadership') || question.includes('manage')) {
          questionTypes.leadership = (questionTypes.leadership || 0) + 1;
        } else if (question.includes('startup') || question.includes('scale')) {
          questionTypes.startup = (questionTypes.startup || 0) + 1;
        } else {
          questionTypes.general = (questionTypes.general || 0) + 1;
        }
        
        // Track response length
        responseLength.push(entry.metadata.responseLength || entry.answer.length);
        
        // Show individual chat summary
        console.log(`  ${entry.timestamp}: ${entry.question.slice(0, 60)}...`);
        
      } catch (error) {
        console.log(`  ❌ Error parsing line: ${error.message}`);
      }
    });
  });
  
  // Summary statistics
  console.log('\n📊 Summary Statistics');
  console.log('=' .repeat(50));
  console.log(`Total chats: ${totalChats}`);
  console.log(`Unique sessions: ${totalSessions.size}`);
  console.log(`Average chats per session: ${(totalChats / totalSessions.size).toFixed(1)}`);
  
  // Daily breakdown
  console.log('\n📅 Daily Breakdown');
  Object.entries(dailyStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, stats]) => {
      console.log(`  ${date}: ${stats.chats} chats, ${stats.sessions.size} sessions`);
    });
  
  // Question type analysis
  console.log('\n❓ Question Types');
  Object.entries(questionTypes)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count} (${((count / totalChats) * 100).toFixed(1)}%)`);
    });
  
  // Response length analysis
  if (responseLength.length > 0) {
    const avgLength = responseLength.reduce((a, b) => a + b, 0) / responseLength.length;
    const maxLength = Math.max(...responseLength);
    const minLength = Math.min(...responseLength);
    
    console.log('\n📝 Response Length Analysis');
    console.log(`  Average: ${avgLength.toFixed(0)} characters`);
    console.log(`  Range: ${minLength} - ${maxLength} characters`);
  }
  
  // Quality indicators
  console.log('\n✅ Quality Indicators');
  const shortResponses = responseLength.filter(len => len < 100).length;
  const longResponses = responseLength.filter(len => len > 500).length;
  
  console.log(`  Short responses (<100 chars): ${shortResponses} (${((shortResponses / totalChats) * 100).toFixed(1)}%)`);
  console.log(`  Detailed responses (>500 chars): ${longResponses} (${((longResponses / totalChats) * 100).toFixed(1)}%)`);
  
  console.log('\n📁 Log files location:', logsDir);
  console.log('💡 Review individual logs for quality assurance');
}

// Command line usage
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'tail') {
    // Show recent chats
    const logsDir = path.join(__dirname, 'logs', 'ama-chats');
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.jsonl')).sort().slice(-1);
    
    if (logFiles.length > 0) {
      const filePath = path.join(logsDir, logFiles[0]);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim()).slice(-5);
      
      console.log('🔄 Recent chats:');
      lines.forEach(line => {
        const entry = JSON.parse(line);
        console.log(`[${entry.timestamp}] Q: ${entry.question}`);
        console.log(`A: ${entry.answer.slice(0, 100)}...\n`);
      });
    }
  } else {
    analyzeAMALogs();
  }
}

module.exports = { analyzeAMALogs };