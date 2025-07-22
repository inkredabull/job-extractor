// Job Extractor Assistant - Background Script

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Job Extractor Assistant installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      firstInstall: Date.now(),
      gutterWidth: 33.333,
      autoDetectJobSites: true
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // The popup will handle the interaction, but we can add additional logic here if needed
  console.log('Extension icon clicked for tab:', tab.url);
});

// Message handling for future communication between components
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'log':
      console.log('Job Extractor:', request.message);
      sendResponse({success: true});
      break;
      
    default:
      sendResponse({success: false, error: 'Unknown action'});
  }
});

console.log('Job Extractor Assistant: Background script loaded');