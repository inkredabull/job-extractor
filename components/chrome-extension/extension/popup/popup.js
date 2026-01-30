// Settings Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const linkedInToggle = document.getElementById('enable-linkedin-networking');
  const statusDiv = document.getElementById('status');
  const openJobTrackerBtn = document.getElementById('open-job-tracker');

  // Load current settings
  chrome.storage.sync.get(['linkedInNetworkingEnabled'], (result) => {
    linkedInToggle.checked = result.linkedInNetworkingEnabled || false;
  });

  // Save settings when changed
  linkedInToggle.addEventListener('change', () => {
    const enabled = linkedInToggle.checked;

    chrome.storage.sync.set({ linkedInNetworkingEnabled: enabled }, () => {
      // Show status message
      statusDiv.textContent = 'Settings saved!';
      statusDiv.className = 'status';

      // Clear status after 2 seconds
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);

      console.log(`LinkedIn Networking: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    });
  });

  // Handle "Open Job Tracker Panel" button
  openJobTrackerBtn.addEventListener('click', () => {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Send message to content script to toggle the gutter
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGutter' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error toggling panel:', chrome.runtime.lastError);
            statusDiv.textContent = 'Error: Content script not loaded';
            statusDiv.className = 'status error';
            setTimeout(() => {
              statusDiv.textContent = '';
            }, 3000);
          } else if (response?.success) {
            console.log('Panel toggled:', response.isOpen ? 'opened' : 'closed');
            // Close the popup after opening the panel
            window.close();
          }
        });
      }
    });
  });
});
