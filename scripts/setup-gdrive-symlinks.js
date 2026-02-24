#!/usr/bin/env node

/**
 * Setup Google Drive Symlinks
 *
 * Creates symlinks from project logs/archive folders to Google Drive.
 * This allows automatic cloud backup via Google Drive Desktop sync.
 *
 * Usage: npm run setup:gdrive
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const projectRoot = path.join(__dirname, '..');

// Google Drive base path
const gDrivePath = path.join(homeDir, 'Google Drive', 'My Drive', 'Professional', 'Job Search', 'career-catalyst');

// Source folders in Google Drive
const gDriveLogsSrc = path.join(gDrivePath, 'logs');
const gDriveArchiveSrc = path.join(gDrivePath, 'archive');

// Symlink targets in project
const logsLink = path.join(projectRoot, 'logs');
const archiveLink = path.join(projectRoot, 'archive');

console.log('🔗 Setting up Google Drive symlinks...\n');

// Check if Google Drive folder exists
if (!fs.existsSync(path.join(homeDir, 'Google Drive'))) {
  console.error('❌ Google Drive not found at:', path.join(homeDir, 'Google Drive'));
  console.error('\nPlease ensure:');
  console.error('1. Google Drive Desktop is installed');
  console.error('2. Google Drive is syncing to the default location');
  console.error('3. The Drive folder exists at ~/Google Drive/My Drive\n');
  process.exit(1);
}

// Create career-catalyst folder structure if it doesn't exist
if (!fs.existsSync(gDrivePath)) {
  console.log('📁 Creating career-catalyst folder in Google Drive...');
  fs.mkdirSync(gDrivePath, { recursive: true });
}

// Function to setup a symlink
function setupSymlink(src, dest, name) {
  // Check if destination already exists
  if (fs.existsSync(dest)) {
    const stats = fs.lstatSync(dest);

    if (stats.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(dest);
      if (currentTarget === src) {
        console.log(`✅ ${name} symlink already exists and points to correct location`);
        return true;
      } else {
        console.log(`⚠️  ${name} symlink exists but points to: ${currentTarget}`);
        console.log(`   Expected: ${src}`);
        console.log('   Remove the existing symlink and run this script again.');
        return false;
      }
    } else if (stats.isDirectory()) {
      console.log(`⚠️  ${name} exists as a regular directory, not a symlink`);
      console.log(`   Path: ${dest}`);
      console.log('\nTo migrate this directory to Google Drive:');
      console.log(`   1. Move it: mv ${dest} ${src}`);
      console.log(`   2. Re-run this script to create the symlink`);
      return false;
    }
  }

  // Create the source directory in Google Drive if it doesn't exist
  if (!fs.existsSync(src)) {
    console.log(`📁 Creating ${name} folder in Google Drive...`);
    fs.mkdirSync(src, { recursive: true });
  }

  // Create the symlink
  try {
    console.log(`🔗 Creating ${name} symlink...`);
    fs.symlinkSync(src, dest);
    console.log(`✅ ${name} symlink created successfully`);
    console.log(`   ${dest} -> ${src}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create ${name} symlink:`, error.message);
    return false;
  }
}

// Setup both symlinks
console.log('Setting up logs symlink:');
const logsSuccess = setupSymlink(gDriveLogsSrc, logsLink, 'logs');
console.log();

console.log('Setting up archive symlink:');
const archiveSuccess = setupSymlink(gDriveArchiveSrc, archiveLink, 'archive');
console.log();

// Final status
if (logsSuccess && archiveSuccess) {
  console.log('✨ Setup complete! Your logs and archives will now sync to Google Drive automatically.');
  console.log(`\n📍 Google Drive location: ${gDrivePath}`);
  console.log('\nYou can access these files:');
  console.log('  - On this machine: ~/Google Drive/My Drive/Professional/Job Search/career-catalyst');
  console.log('  - On the web: drive.google.com → Professional → Job Search → career-catalyst');
  console.log('  - On other devices: Install Google Drive Desktop and sync the folder\n');
  process.exit(0);
} else {
  console.log('⚠️  Setup incomplete. Please review the messages above and try again.\n');
  process.exit(1);
}
