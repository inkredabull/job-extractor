document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleGutter');
  const status = document.getElementById('status');
  
  // Check current state
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    // Add small delay to ensure content script is loaded
    setTimeout(() => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getGutterState'}, function(response) {
        if (chrome.runtime.lastError) {
          // Content script not ready, inject it manually
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }, () => {
            updateButton(false);
          });
          return;
        }
        
        updateButton(response?.isOpen || false);
      });
    }, 100);
  });
  
  // Handle toggle button click
  toggleButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleGutter'}, function(response) {
        if (chrome.runtime.lastError) {
          // Try to inject content script and then toggle
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }, () => {
            // Wait a bit for script to initialize, then try again
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleGutter'}, function(response) {
                if (response?.success) {
                  updateButton(response.isOpen);
                  showStatus(response.isOpen ? 'Panel opened!' : 'Panel closed!', 'success');
                } else {
                  showStatus('Error: Failed to toggle panel', 'error');
                }
              });
            }, 200);
          });
          return;
        }
        
        if (response?.success) {
          updateButton(response.isOpen);
          showStatus(
            response.isOpen ? 'Panel opened!' : 'Panel closed!', 
            'success'
          );
        } else {
          showStatus('Error: Failed to toggle panel', 'error');
        }
      });
    });
  });
  
  function updateButton(isOpen) {
    toggleButton.textContent = isOpen ? 'Close Assistant Panel' : 'Open Assistant Panel';
  }
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
});