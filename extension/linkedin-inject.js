// LinkedIn Feed Network Injection Script
// This script runs in the MAIN world at document_start to intercept requests before LinkedIn overrides them

console.log('LinkedIn Feed Injector: Script loaded at document_start');

// Save references to original methods before LinkedIn can override them
const originalFetch = window.fetch;
const originalXHROpen = XMLHttpRequest.prototype.open;

console.log('LinkedIn Feed Injector: Original methods saved');

// Override fetch immediately
window.fetch = async function(...args) {
  const [url, options] = args;
  
  // Check if this is a LinkedIn save request
  if (typeof url === 'string' && url.includes('voyagerFeedDashSaveStates')) {
    console.log('LinkedIn Feed Injector: 🎯 Save API request detected!', {
      url,
      method: options?.method || 'GET',
      body: options?.body
    });
    
    // Extract activity URN from URL
    const activityUrn = extractActivityUrnFromSaveUrl(url);
    if (activityUrn) {
      console.log('LinkedIn Feed Injector: Extracted activity URN:', activityUrn);
      
      // Check if this is actually saving (not unsaving)
      const isActuallySaving = checkIfSavingRequest(options);
      if (isActuallySaving) {
        console.log('LinkedIn Feed Injector: Confirmed this is a SAVE request');
        
        // Post message to content script
        window.postMessage({
          type: 'LINKEDIN_POST_SAVED',
          activityUrn: activityUrn,
          url: url,
          timestamp: Date.now()
        }, '*');
      }
    }
  }
  
  // Continue with the original request
  return originalFetch.apply(this, args);
};

// Override XMLHttpRequest
XMLHttpRequest.prototype.open = function(method, url, ...args) {
  if (typeof url === 'string' && url.includes('voyagerFeedDashSaveStates')) {
    console.log('LinkedIn Feed Injector: 🎯 Save XHR request detected!', {
      method,
      url
    });
    
    const activityUrn = extractActivityUrnFromSaveUrl(url);
    if (activityUrn) {
      // Set up response handler
      this.addEventListener('load', function() {
        if (this.status >= 200 && this.status < 300) {
          console.log('LinkedIn Feed Injector: Save XHR completed successfully');
          
          // Post message to content script
          window.postMessage({
            type: 'LINKEDIN_POST_SAVED',
            activityUrn: activityUrn,
            url: url,
            timestamp: Date.now()
          }, '*');
        }
      });
    }
  }
  
  return originalXHROpen.call(this, method, url, ...args);
};

function extractActivityUrnFromSaveUrl(url) {
  try {
    // URL format: /voyagerFeedDashSaveStates/urn%3Ali%3Afsd_saveState%3A(SAVE%2Curn%3Ali%3Aactivity%3A7379230453674942464)
    const match = url.match(/urn%3Ali%3Aactivity%3A(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Try without URL encoding
    const match2 = url.match(/urn:li:activity:(\d+)/);
    if (match2 && match2[1]) {
      return match2[1];
    }
    
    return null;
  } catch (error) {
    console.error('LinkedIn Feed Injector: Error extracting activity URN:', error);
    return null;
  }
}

function checkIfSavingRequest(options) {
  try {
    if (!options || !options.body) return true; // Default to true if we can't determine
    
    const body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    const bodyObj = JSON.parse(body);
    return bodyObj?.patch?.$set?.saved === true;
  } catch (error) {
    return true; // Default to true if we can't determine
  }
}

console.log('LinkedIn Feed Injector: Network overrides set up successfully');