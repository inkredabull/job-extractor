// Shared message types for Chrome extension communication

const MessageTypes = {
  // Job Tracker messages
  TRACK_JOB: 'trackJob',
  GENERATE_BLURB: 'generateBlurb',
  ASK_QUESTION: 'askQuestion',

  // LinkedIn Networking messages
  EXTRACT_CONNECTIONS: 'extractConnections',
  EXTRACT_MUTUAL_CONNECTIONS: 'extractMutualConnections',
  CREATE_LINKEDIN_POST_REMINDER: 'createLinkedInPostReminder',

  // Settings messages
  GET_SETTINGS: 'getSettings',
  UPDATE_SETTINGS: 'updateSettings'
};

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.MessageTypes = MessageTypes;
}
