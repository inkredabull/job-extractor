// Settings Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const linkedInToggle = document.getElementById('enable-linkedin-networking');
  const statusDiv = document.getElementById('status');

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
});
