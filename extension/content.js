// Job Extractor Assistant - Content Script
let gutterElement = null;
let isGutterOpen = false;
let extractedJobDescription = '';

// Global toggle for Job Extractor Assistant
let jobExtractorEnabled = true;

// Track if we've already processed a search page to avoid duplicates
let searchPageProcessed = false;

// Track profiles that have already been prompted to avoid duplicate confirmations
let promptedProfiles = new Set();

// Track if extraction is already running to avoid duplicates
let linkedInExtractionRunning = false;

// Expose global toggle function to browser console immediately
window.toggleJobExtractor = function(enabled) {
  if (typeof enabled === 'boolean') {
    jobExtractorEnabled = enabled;
    console.log(`Job Extractor Assistant ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (!enabled && gutterElement) {
      closeGutter();
    }
  } else {
    // Toggle current state if no parameter provided
    jobExtractorEnabled = !jobExtractorEnabled;
    console.log(`Job Extractor Assistant ${jobExtractorEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (!jobExtractorEnabled && gutterElement) {
      closeGutter();
    }
  }
  
  return jobExtractorEnabled;
};

// Expose status check function
window.getJobExtractorStatus = function() {
  console.log(`Job Extractor Assistant is currently ${jobExtractorEnabled ? 'ENABLED' : 'DISABLED'}`);
  return jobExtractorEnabled;
};

// Expose manual mutual connections extraction function
window.extractCurrentPage = globalThis.extractCurrentPage = function() {
  console.log('Extracting mutual connections from current page...');
  
  try {
    // Get the target profile URL from localStorage 
    var targetProfileUrl = localStorage.getItem('linkedin_target_profile_url') || '';
    console.log(`Target profile URL: "${targetProfileUrl}"`);
    
    // Extract first name directly from the URL
    var targetFirstName = 'Unknown';
    if (targetProfileUrl) {
      var urlMatch = targetProfileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (urlMatch) {
        var urlSlug = urlMatch[1];
        // Convert URL slug to first name: "seldo" -> "Seldo"
        var firstName = urlSlug
          .split('-')[0]                    // Get first part before hyphens
          .replace(/\d+/g, '')             // Remove any numbers
          .trim();
        
        if (firstName.length > 0) {
          targetFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        }
      }
    }
    
    console.log(`Extracted first name from URL: "${targetFirstName}"`);
    
    // Extract mutual connections using the same logic as the automatic function
    var identifier = document.querySelectorAll('div.mb1 a')[0]?.className.trim();
    if (!identifier) {
      console.log('Could not find identifier for mutual connections on this page');
      return;
    }
    
    var result = 'Full,PersonName,PersonURL\n'; // CSV headers
    var selector = '.t-16 a.' + identifier + '>span>span:not(.visually-hidden)';
    var nameElements = document.querySelectorAll(selector);
    
    nameElements.forEach((element) => {
      var mutualConnectionName = element.innerText.trim();
      if (mutualConnectionName) {
        // Output format: mutual connection full name, target profile first name, target profile URL
        var csvRow = `"${mutualConnectionName}","${targetFirstName}","${targetProfileUrl}"`;
        result += csvRow + '\n';
      }
    });
    
    if (nameElements.length > 0) {
      console.log('Complete CSV output:');
      console.log(result);
      return result;
    } else {
      console.log('No mutual connection names found on current page');
      return null;
    }
    
  } catch (error) {
    console.error('Error extracting mutual connections from current page:', error);
    return null;
  }
};

// Create the right gutter
function createGutter() {
  if (gutterElement) return;
  
  gutterElement = document.createElement('div');
  gutterElement.id = 'job-extractor-gutter';
  gutterElement.innerHTML = `
    <div class="gutter-header">
      <h3>🎯 Job Extractor Assistant</h3>
      <button id="close-gutter">×</button>
    </div>
    <div class="gutter-content">
      <div class="llm-interface">
        <h4>AI Assistant</h4>
        <p>Ask a question to get AI-powered insights:</p>
        
        <div class="input-section">
          <input type="text" id="llm-input" placeholder="Enter your question here...">
          <button id="submit-query" class="submit-btn">Submit</button>
        </div>
        
        <div id="llm-response" class="response-section" style="display: none;">
          <div class="response-header">
            <span class="status-indicator success">✓</span>
            <strong>AI Response:</strong>
          </div>
          <div class="response-content"></div>
        </div>
        
        <div class="current-url">
          <strong>Current URL:</strong><br>
          <span id="current-url-display">${window.location.href}</span>
        </div>
        
        <div id="page-questions" class="page-analysis" style="display: none;">
          <h5>Questions Found on Page:</h5>
          <ul id="questions-list"></ul>
        </div>
      </div>
      
      <div class="job-information-section">
        <h4>📄 Job Information</h4>
        <p>Auto-extracted job details (editable):</p>
        
        <div class="form-field">
          <label for="job-title">Job Title:</label>
          <input type="text" id="job-title" class="job-input" placeholder="Job title will be extracted automatically...">
        </div>
        
        <div class="form-field">
          <label for="company-name">Company:</label>
          <input type="text" id="company-name" class="job-input" placeholder="Company name will be extracted automatically...">
        </div>
        
        <div class="form-field">
          <label for="job-location">Location:</label>
          <input type="text" id="job-location" class="job-input" placeholder="Job location will be extracted automatically...">
        </div>
        
        <div class="form-field salary-range">
          <label>Salary Range:</label>
          <div class="salary-inputs">
            <input type="text" id="min-salary" class="job-input salary-input" placeholder="Min (e.g., 120000)">
            <span class="salary-separator">to</span>
            <input type="text" id="max-salary" class="job-input salary-input" placeholder="Max (e.g., 160000)">
          </div>
        </div>
        
        <div class="form-field">
          <label for="job-url">Job URL:</label>
          <input type="text" id="job-url" class="job-input" placeholder="Current page URL">
        </div>
        
        <div class="form-field">
          <label for="job-description">Description:</label>
          <textarea id="job-description" class="job-description-textarea" placeholder="Job description will be extracted automatically..."></textarea>
        </div>
        
        <!-- TEAL INTEGRATION COMMENTED OUT - Don't remove, just disabled
        <div class="form-field">
          <label class="radio-label">
            <input type="checkbox" id="track-in-teal-checkbox" class="teal-checkbox" checked>
            <span class="checkmark"></span>
            Track in Teal?
          </label>
        </div>
        -->
        
        <div class="form-field">
          <label for="reminder-priority">Priority:</label>
          <select id="reminder-priority" class="priority-select">
            <option value="9">Low</option>
            <option value="5" selected>Medium</option>
            <option value="1">High</option>
          </select>
        </div>
        
        <div class="button-group">
          <button id="track-job-info" class="track-btn">Track</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(gutterElement);
  
  // Add close button functionality
  document.getElementById('close-gutter').addEventListener('click', closeGutter);
  
  // Add submit button functionality
  document.getElementById('submit-query').addEventListener('click', handleLLMQuery);
  
  // Add Enter key functionality for input
  document.getElementById('llm-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLLMQuery();
    }
  });
  
  
  // Add track job from form fields functionality
  document.getElementById('track-job-info').addEventListener('click', handleTrackFromForm);
  
  
  // Extract job information automatically when gutter opens (with slight delay for DOM)
  setTimeout(() => {
    extractJobInformation();
  }, 100);
  
  // Analyze page content for questions
  analyzePageContent();
  
  console.log('Job Extractor: Gutter created');
}

// Extract comprehensive job information from the current page
function extractJobInformation() {
  console.log('🔍 Job Extractor: Starting comprehensive job information extraction');
  console.log('🔍 Current page URL:', window.location.href);
  console.log('🔍 Page title:', document.title);
  
  // Debug: Check what H1 elements exist
  const h1Elements = document.querySelectorAll('h1');
  console.log('🔍 Found H1 elements:', Array.from(h1Elements).map(el => el.textContent?.trim()));
  
  // Debug: Check what elements have "job" or "title" in their attributes
  const jobElements = document.querySelectorAll('[class*="job"], [data-testid*="job"], [class*="title"]');
  console.log('🔍 Found job-related elements:', jobElements.length);
  
  // Extract job title
  const jobTitle = extractJobTitle();
  const titleField = document.getElementById('job-title');
  if (titleField) {
    titleField.value = jobTitle;
    titleField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Extract company name
  const companyName = extractCompanyName();
  const companyField = document.getElementById('company-name');
  if (companyField) {
    companyField.value = companyName;
    companyField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Extract location
  const location = extractJobLocation();
  const locationField = document.getElementById('job-location');
  if (locationField) {
    // Only set value if it's actually visible text
    const cleanedLocation = location && location.trim().length > 0 ? location : '';
    locationField.value = cleanedLocation;
    locationField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Extract job description
  extractJobDescription();
  const descriptionField = document.getElementById('job-description');
  if (descriptionField) descriptionField.value = extractedJobDescription;
  
  // Extract salary information
  const salaryInfo = extractSalaryRange();
  const minSalaryField = document.getElementById('min-salary');
  const maxSalaryField = document.getElementById('max-salary');
  if (minSalaryField && salaryInfo.min) {
    minSalaryField.value = salaryInfo.min;
    minSalaryField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (maxSalaryField && salaryInfo.max) {
    maxSalaryField.value = salaryInfo.max;
    maxSalaryField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Set the current URL
  const urlField = document.getElementById('job-url');
  if (urlField) urlField.value = window.location.href;
  
  console.log('Job Extractor: Job information extracted:', {
    title: jobTitle,
    company: companyName,
    location: location,
    salary: salaryInfo,
    url: window.location.href,
    hasDescription: extractedJobDescription.length > 0
  });
  
  // Debug: Check if fields exist and were populated
  console.log('Job Extractor: Field population check:', {
    titleField: !!document.getElementById('job-title'),
    titleValue: document.getElementById('job-title')?.value,
    companyField: !!document.getElementById('company-name'),
    companyValue: document.getElementById('company-name')?.value,
    locationField: !!document.getElementById('job-location'),
    locationValue: document.getElementById('job-location')?.value,
    minSalaryField: !!document.getElementById('min-salary'),
    minSalaryValue: document.getElementById('min-salary')?.value,
    maxSalaryField: !!document.getElementById('max-salary'),
    maxSalaryValue: document.getElementById('max-salary')?.value,
    urlField: !!document.getElementById('job-url'),
    urlValue: document.getElementById('job-url')?.value
  });
}

// Extract job title from the current page
function extractJobTitle() {
  const titleSelectors = [
    'h1[data-testid*="job"]',
    'h1[data-testid*="title"]',
    '[data-testid*="job-title"]',
    '[data-testid*="jobTitle"]',
    '.job-title',
    '.position-title',
    '.role-title',
    'h1:first-of-type',
    '.job-header h1',
    '.job-post-title',
    '[class*="job"][class*="title"]',
    '[data-automation-id*="title"]'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return cleanText(element.textContent);
    }
  }
  
  // Fallback: try to extract from page title
  const pageTitle = document.title.split('|')[0].split('-')[0].split('at')[0].trim();
  if (pageTitle && pageTitle.length > 3) {
    return pageTitle;
  }
  
  return '';
}

// Extract company name from the current page
function extractCompanyName() {
  console.log('🔍 Job Extractor: Extracting company name');
  
  // Priority 1: Look for company in job description or visible text content
  const descText = extractedJobDescription || document.body.innerText || '';
  
  // Check for specific company patterns in content
  const companyMatches = [
    descText.match(/work(?:ing)?\s+(?:at|for)\s+([A-Z][A-Za-z\s&]+?)(?:\s|,|\.|!|\?|$)/i),
    descText.match(/([A-Z][A-Za-z\s&]+?)\s+is\s+(?:a|an|the)/i),
    descText.match(/join\s+(?:the\s+)?([A-Z][A-Za-z\s&]+?)\s+team/i),
    descText.match(/([A-Z][A-Za-z\s&]+?)\s+(?:team|company|organization)/i)
  ];
  
  for (const match of companyMatches) {
    if (match && match[1]) {
      const company = cleanText(match[1]);
      // Filter out common false positives
      if (company && company.length > 2 && company.length < 50 &&
          !company.toLowerCase().includes('engineering') &&
          !company.toLowerCase().includes('product') &&
          !company.toLowerCase().includes('software') &&
          !company.toLowerCase().includes('technical') &&
          !company.toLowerCase().includes('development')) {
        console.log(`🔍 Found company from content: "${company}"`);
        return company;
      }
    }
  }
  
  // Priority 2: DOM-based selectors
  const companySelectors = [
    '[data-testid*="company"]',
    '.company-name',
    '.employer-name',
    '.job-company',
    '[class*="company"][class*="name"]',
    '[data-automation-id*="company"]',
    '.company',
    '[class*="employer"]'
  ];
  
  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      const company = cleanText(element.textContent);
      console.log(`🔍 Found company from selector "${selector}": "${company}"`);
      return company;
    }
  }
  
  // Priority 3: Specific site handling
  if (window.location.href.includes('linear.app/careers')) {
    return 'Linear';
  }
  
  // Handle Rippling ATS - extract company from URL path
  if (window.location.hostname.includes('rippling.com') && window.location.pathname.includes('join')) {
    const pathParts = window.location.pathname.split('/');
    const joinIndex = pathParts.findIndex(part => part.startsWith('join'));
    if (joinIndex >= 0 && pathParts[joinIndex].length > 4) {
      const companySlug = pathParts[joinIndex].replace('join', '');
      // Convert slug to proper company name
      const companyNames = {
        'root': 'Root Insurance',
        'stripe': 'Stripe', 
        'airbnb': 'Airbnb',
        'uber': 'Uber',
        'lyft': 'Lyft'
        // Add more as needed
      };
      if (companyNames[companySlug.toLowerCase()]) {
        console.log(`🔍 Found company from Rippling URL: "${companyNames[companySlug.toLowerCase()]}"`);
        return companyNames[companySlug.toLowerCase()];
      }
      // Fallback: capitalize the slug
      const capitalizedCompany = companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
      console.log(`🔍 Found company from Rippling URL (capitalized): "${capitalizedCompany}"`);
      return capitalizedCompany;
    }
  }
  
  // Priority 4: Check for company logo or branding elements
  const logoSelectors = ['[alt*="logo" i]', '[class*="logo"]', 'img[src*="logo"]'];
  for (const selector of logoSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const alt = element.getAttribute('alt');
      if (alt && alt.toLowerCase().includes('logo')) {
        const company = alt.replace(/logo/gi, '').trim();
        console.log(`🔍 Found company from logo: "${company}"`);
        return company;
      }
    }
  }
  
  // Priority 5: Meta tags
  const metaCompany = document.querySelector('meta[property="og:site_name"]');
  if (metaCompany && metaCompany.content) {
    console.log(`🔍 Found company from meta tag: "${metaCompany.content}"`);
    return metaCompany.content;
  }
  
  // Priority 6: Try extracting from page title (after "at")
  const titleParts = document.title.split(' at ');
  if (titleParts.length > 1) {
    const company = titleParts[1].split('|')[0].split('-')[0].trim();
    console.log(`🔍 Found company from page title: "${company}"`);
    return company;
  }
  
  // Last resort: Try extracting from URL subdomain (but avoid common false positives)
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'ats' && parts[0] !== 'jobs' && parts[0] !== 'careers') {
    const company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    console.log(`🔍 Found company from hostname: "${company}"`);
    return company;
  }
  
  console.log('🔍 No company name found');
  return '';
}

// Extract job location from the current page
function extractJobLocation() {
  console.log('Job Extractor: Extracting job location from page');
  
  // Priority 1: Try specific location selectors first
  const locationSelectors = [
    '[data-testid*="location"]',
    '[data-testid*="jobLocation"]',
    '.job-location',
    '.position-location', 
    '[data-automation-id*="location"]',
    '.job-info .location',
    '[class*="job"][class*="location"]',
    '.location-info'
  ];
  
  for (const selector of locationSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      const cleaned = cleanText(element.textContent);
      console.log(`Job Extractor: Found location via selector "${selector}": "${cleaned}"`);
      // Filter out obvious non-location text
      if (cleaned && 
          cleaned.length > 0 && 
          cleaned.length < 100 &&
          !cleaned.toLowerCase().includes('salary') &&
          !cleaned.toLowerCase().includes('priority') &&
          !cleaned.toLowerCase().includes('track') &&
          !cleaned.toLowerCase().includes('description') &&
          !cleaned.toLowerCase().includes('url')) {
        return cleaned;
      }
    }
  }
  
  // Priority 2: Look for structured data
  const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
  for (const element of jsonLdElements) {
    try {
      const data = JSON.parse(element.textContent);
      if (data['@type'] === 'JobPosting' && data.jobLocation) {
        if (data.jobLocation.address) {
          const location = data.jobLocation.address.addressLocality || 
                          data.jobLocation.address.addressRegion ||
                          data.jobLocation.address.name;
          if (location) {
            console.log(`Job Extractor: Found location in JSON-LD: "${location}"`);
            return cleanText(location);
          }
        }
        if (typeof data.jobLocation === 'string') {
          console.log(`Job Extractor: Found location string in JSON-LD: "${data.jobLocation}"`);
          return cleanText(data.jobLocation);
        }
      }
    } catch (e) {
      // Continue to next element
    }
  }
  
  // Priority 3: Look for common location text patterns in main content area only
  const mainContentSelectors = [
    'main', 
    '[role="main"]', 
    '.job-content', 
    '.job-description',
    '.job-details',
    '.job-header',
    '.job-info'
  ];
  
  let searchArea = document.body;
  for (const selector of mainContentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      searchArea = element;
      break;
    }
  }
  
  const textContent = searchArea.textContent || '';
  const locationPatterns = [
    /(?:Location|Based in|Office|Work from|City):\s*([^\n\r\.,;]+)/i,
    /(?:^|\n|\r)\s*Location:\s*([^\n\r\.,;]+)/i,
    /(?:Remote|Hybrid|On-site)\s*[-,]?\s*([A-Za-z\s,]{2,40})(?=\s|$|\n)/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      const locationText = cleanText(match[1].trim());
      console.log(`Job Extractor: Found location via pattern: "${locationText}"`);
      if (locationText && 
          locationText.length > 1 && 
          locationText.length < 50 &&
          !locationText.toLowerCase().includes('salary') &&
          !locationText.toLowerCase().includes('priority') &&
          !locationText.toLowerCase().includes('track') &&
          !locationText.toLowerCase().includes('description') &&
          !locationText.toLowerCase().includes('url')) {
        return locationText;
      }
    }
  }
  
  // Priority 4: Look for specific location keywords but exclude form elements
  const locationKeywords = ['Remote', 'Hybrid', 'On-site', 'San Francisco', 'New York', 'London', 'Berlin', 'Austin', 'Seattle', 'Boston', 'Chicago', 'Los Angeles', 'Toronto', 'Vancouver'];
  
  // Get all text elements but exclude form elements and our extension
  const allTextElements = Array.from(document.querySelectorAll('*:not(input):not(textarea):not(select):not(button):not(label):not(#job-extractor-gutter):not(#job-extractor-gutter *)'))
    .filter(el => {
      const text = el.textContent?.trim();
      return text && 
             text.length < 50 && 
             text.length > 2 &&
             el.children.length === 0 && // Only leaf text nodes
             !el.closest('#job-extractor-gutter'); // Exclude our extension
    })
    .map(el => el.textContent.trim());
  
  for (const keyword of locationKeywords) {
    const found = allTextElements.find(text => 
      text.includes(keyword) && 
      !text.toLowerCase().includes('experience') && 
      !text.toLowerCase().includes('requirements') &&
      !text.toLowerCase().includes('skills') &&
      !text.toLowerCase().includes('salary') &&
      !text.toLowerCase().includes('priority') &&
      !text.toLowerCase().includes('track') &&
      !text.toLowerCase().includes('description') &&
      !text.toLowerCase().includes('url') &&
      text.length < 40
    );
    if (found) {
      const cleaned = cleanText(found);
      console.log(`Job Extractor: Found location via keyword "${keyword}": "${cleaned}"`);
      if (cleaned && cleaned.length > 0 && cleaned.length < 40) {
        return cleaned;
      }
    }
  }
  
  console.log('Job Extractor: No location found');
  return '';
}

// Extract salary range from the current page
function extractSalaryRange() {
  console.log('🔍 Job Extractor: Extracting salary range');
  
  // Get all text content to search for salary patterns
  const pageText = document.body.innerText || '';
  const descText = extractedJobDescription || '';
  const combinedText = descText + '\n' + pageText;
  
  // Comprehensive salary patterns
  const salaryPatterns = [
    // Standard formats: $300,000-450,000, $300K-$450K, etc.
    /\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s*[-–—to]\s*\$?(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    // Range with "to": $300,000 to $450,000
    /\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s+to\s+\$?(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    // Range with "and": between $300,000 and $450,000
    /between\s+\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s+and\s+\$?(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    // Salary range: text
    /salary\s+range:?\s*\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s*[-–—to]\s*\$?(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    // Compensation: text  
    /compensation:?\s*\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s*[-–—to]\s*\$?(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    // Base salary: text
    /base\s+salary:?\s*\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s*[-–—to]\s*\$?(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi
  ];
  
  for (const pattern of salaryPatterns) {
    const matches = combinedText.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        const min = parseSalaryValue(match[1]);
        const max = parseSalaryValue(match[2]);
        
        // Validate that the range makes sense
        if (min > 0 && max > 0 && min < max && min >= 20000 && max <= 2000000) {
          console.log(`🔍 Found salary range: $${min.toLocaleString()} - $${max.toLocaleString()}`);
          return {
            min: min.toString(),
            max: max.toString()
          };
        }
      }
    }
  }
  
  // Look for single salary values that might indicate a range midpoint
  const singleSalaryPatterns = [
    /salary:?\s*\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    /compensation:?\s*\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)/gi,
    /\$(\d{1,3}(?:,\d{3})*|\d+[kK]?)\s+(?:per\s+year|annually|salary)/gi
  ];
  
  for (const pattern of singleSalaryPatterns) {
    const matches = combinedText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const salary = parseSalaryValue(match[1]);
        if (salary >= 50000 && salary <= 1000000) {
          // Estimate a range around the single value (±20%)
          const min = Math.round(salary * 0.8);
          const max = Math.round(salary * 1.2);
          console.log(`🔍 Found single salary value, estimating range: $${min.toLocaleString()} - $${max.toLocaleString()}`);
          return {
            min: min.toString(),
            max: max.toString()
          };
        }
      }
    }
  }
  
  console.log('🔍 No salary range found');
  return { min: '', max: '' };
}

// Helper function to parse salary values (handles K suffix and commas)
function parseSalaryValue(value) {
  if (!value) return 0;
  
  // Remove commas and dollar signs
  let cleaned = value.replace(/[\$,]/g, '');
  
  // Handle K suffix
  if (cleaned.toLowerCase().endsWith('k')) {
    return parseInt(cleaned.slice(0, -1)) * 1000;
  }
  
  return parseInt(cleaned) || 0;
}

// Extract job description from the current page
function extractJobDescription() {
  try {
    console.log('Job Extractor: Extracting job description from page');
    
    // Strategy 1: Look for JSON-LD structured data first (similar to CLI tool)
    const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
    for (const element of jsonLdElements) {
      try {
        const data = JSON.parse(element.textContent);
        if (data['@type'] === 'JobPosting' && data.description) {
          extractedJobDescription = cleanText(data.description);
          console.log('Job Extractor: Found job description in JSON-LD');
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Strategy 2: Look for common job description patterns
    const jobDescriptionSelectors = [
      // Common job site patterns
      '[data-testid*="job-description"]',
      '[data-testid*="jobDescription"]',
      '.job-description',
      '.job-content',
      '.job-details',
      '.job-summary',
      '.position-description',
      '.role-description',
      '#job-description',
      '#job-content',
      '#job-details',
      
      // Workday patterns
      '[data-automation-id*="jobPostingDescription"]',
      '[data-automation-id*="job-description"]',
      
      // Greenhouse patterns
      '#content .section:first-of-type',
      '.job-post__content',
      
      // LinkedIn patterns
      '.jobs-description-content__text',
      '.jobs-description__container',
      
      // Generic patterns
      '[class*="job"][class*="description"]',
      '[class*="position"][class*="description"]',
      '[id*="job"][id*="description"]'
    ];
    
    for (const selector of jobDescriptionSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 100) {
        extractedJobDescription = cleanText(element.textContent);
        console.log(`Job Extractor: Found job description using selector: ${selector}`);
        return;
      }
    }
    
    // Strategy 3: Look for main content areas and extract the longest text block
    const mainContentSelectors = ['main', '[role="main"]', '.main-content', '#main-content', '.content'];
    for (const selector of mainContentSelectors) {
      const mainElement = document.querySelector(selector);
      if (mainElement) {
        const textBlocks = Array.from(mainElement.querySelectorAll('p, div'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 200)
          .sort((a, b) => b.length - a.length);
        
        if (textBlocks.length > 0) {
          extractedJobDescription = cleanText(textBlocks[0]);
          console.log('Job Extractor: Found job description in main content area');
          return;
        }
      }
    }
    
    // Strategy 4: Fallback - get the longest paragraph on the page
    const allParagraphs = Array.from(document.querySelectorAll('p, div'))
      .filter(el => !el.closest('#job-extractor-gutter')) // Exclude our own content
      .map(el => el.textContent.trim())
      .filter(text => text.length > 150 && !isNavigationalText(text))
      .sort((a, b) => b.length - a.length);
    
    if (allParagraphs.length > 0) {
      extractedJobDescription = cleanText(allParagraphs[0]);
      console.log('Job Extractor: Found job description using fallback method');
      return;
    }
    
    // If nothing found, set a helpful message
    extractedJobDescription = 'No job description could be automatically extracted from this page. Please paste the job description manually.';
    console.log('Job Extractor: No job description found');
    
  } catch (error) {
    console.error('Job Extractor: Error extracting job description:', error);
    extractedJobDescription = 'Error extracting job description. Please paste manually.';
  }
}

// Clean extracted text
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/[\r\n\t]+/g, ' ') // Replace line breaks and tabs with space
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim()
    .substring(0, 2000); // Limit length to avoid overly long descriptions
}

// Check if text looks like navigation/header/footer content
function isNavigationalText(text) {
  const navPatterns = [
    /^(home|about|contact|login|register|sign in|menu)/i,
    /^(copyright|privacy|terms|cookies)/i,
    /^(search|filter|sort by)/i,
    /^(next|previous|page \d+)/i,
    /(navigation|breadcrumb|footer|header)/i
  ];
  
  return navPatterns.some(pattern => pattern.test(text)) || text.length < 50;
}

// Handle LLM query submission
async function handleLLMQuery() {
  const input = document.getElementById('llm-input');
  const submitBtn = document.getElementById('submit-query');
  const responseDiv = document.getElementById('llm-response');
  const responseContent = responseDiv.querySelector('.response-content');
  
  const query = input.value.trim();
  if (!query) return;
  
  // Show loading state
  submitBtn.textContent = 'Processing...';
  submitBtn.disabled = true;
  responseDiv.style.display = 'block';
  responseContent.innerHTML = '<div class="loading">🤔 Thinking...</div>';
  
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Try to get CV-aware response first, fallback to mock
    let response = await generateCVAwareResponse(query);
    let isRealResponse = false;
    if (!response) {
      response = generateMockResponse(query);
      console.log('Job Extractor: Using fallback mock response');
    } else {
      console.log('Job Extractor: Using CV-aware response');
      isRealResponse = true;
    }
    
    // Display successful response with appropriate metadata
    const metadata = isRealResponse 
      ? '<small>✅ CV-aware response from Claude 3.5 Sonnet</small>'
      : '<small>⚠️ Mock response (MCP server not available)</small>';
    
    responseContent.innerHTML = `
      <div class="api-metadata">
        ${metadata}
      </div>
      <div class="response-text">${response}</div>
    `;
    
    console.log('Job Extractor: Mock LLM API call successful');
    
  } catch (error) {
    // Display error state
    responseContent.innerHTML = `
      <div class="error-message">
        <span class="status-indicator error">✗</span>
        <strong>Error:</strong> Failed to connect to AI service
      </div>
    `;
    console.error('Job Extractor: LLM API call failed', error);
  }
  
  // Reset button state
  submitBtn.textContent = 'Submit';
  submitBtn.disabled = false;
}

// Generate mock AI response based on input
function generateMockResponse(query) {
  const responses = {
    job: "This appears to be a job posting for a software engineering role. Key requirements include experience with JavaScript, React, and Node.js. The company offers competitive compensation and remote work options.",
    salary: "Based on the job description, this role likely offers a salary range of $90k-$140k annually, depending on experience level and location.",
    company: "This company appears to be a mid-stage startup in the fintech space. They have strong growth metrics and recent Series B funding.",
    interview: "For this role, expect technical interviews covering algorithms, system design, and behavioral questions. I'd recommend preparing examples of your React projects and distributed systems experience.",
    default: "I can help you analyze job postings, salary ranges, company research, and interview preparation. Feel free to ask specific questions about the current page or career advice!"
  };
  
  const lowerQuery = query.toLowerCase();
  for (const [key, response] of Object.entries(responses)) {
    if (lowerQuery.includes(key)) {
      return response;
    }
  }
  
  return responses.default;
}

// TEAL INTEGRATION COMMENTED OUT - Don't remove, just disabled
/*
// Handle Teal tracking functionality
async function handleTealTracking() {
  const trackBtn = document.getElementById('track-in-teal');
  const statusDiv = document.getElementById('teal-status');
  
  // Show loading state
  trackBtn.textContent = 'Extracting...';
  trackBtn.disabled = true;
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div class="loading">🚀 Extracting job data...</div>';
  statusDiv.className = 'teal-status loading';
  
  try {
    // First, extract job data server-side to get normalized JSON
    statusDiv.innerHTML = '<div class="loading">🚀 Extracting job data from page...</div>';
    
    const extractResponse = await chrome.runtime.sendMessage({
      action: 'extractJob',
      url: window.location.href
    });
    
    if (!extractResponse.success) {
      throw new Error(extractResponse.error || 'Failed to extract job data');
    }
    
    // Update status to show we're opening Teal
    statusDiv.innerHTML = '<div class="loading">🔖 Opening Teal and filling form...</div>';
    trackBtn.textContent = 'Opening...';
    
    // Use the extracted job data for Teal form filling, with fallback to form fields
    const jobInfo = extractResponse.jobData || {
      title: document.getElementById('job-title')?.value || 'Unknown Title',
      company: document.getElementById('company-name')?.value || 'Unknown Company',
      location: document.getElementById('job-location')?.value || 'Unknown Location',
      url: document.getElementById('job-url')?.value || window.location.href,
      description: document.getElementById('job-description')?.value || 'No description available',
      minSalary: document.getElementById('min-salary')?.value || '',
      maxSalary: document.getElementById('max-salary')?.value || ''
    };
    
    // Send extracted job info to background script to handle the new tab and automation
    const response = await chrome.runtime.sendMessage({
      action: 'openTealAndFill',
      jobInfo: jobInfo
    });
    
    if (response.success) {
      // Show success message
      statusDiv.innerHTML = `
        <div class="success-message">
          <span class="status-indicator success">✓</span>
          <strong>Success!</strong> Job extracted and Teal opened
          <br><small>Job ID: ${extractResponse.jobId}</small>
          <br><small>Form being auto-filled in new tab</small>
        </div>
      `;
      statusDiv.className = 'teal-status success';
    } else {
      statusDiv.innerHTML = `
        <div class="error-message">
          <span class="status-indicator error">✗</span>
          <strong>Error:</strong> ${response.error || 'Failed to open Teal'}
        </div>
      `;
      statusDiv.className = 'teal-status error';
    }
    
  } catch (error) {
    statusDiv.innerHTML = `
      <div class="error-message">
        <span class="status-indicator error">✗</span>
        <strong>Error:</strong> ${error.message}
        <br><small>Failed to extract job or open Teal</small>
      </div>
    `;
    statusDiv.className = 'teal-status error';
    console.error('Job Extractor: Teal tracking failed', error);
  }
  
  // Reset button state
  trackBtn.textContent = 'Extract & Track';
  trackBtn.disabled = false;
  
  // Hide status after 8 seconds if successful (longer to show job ID)
  if (statusDiv.className.includes('success')) {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 8000);
  }
}
*/

// Handle tracking job using form field values
async function handleTrackFromForm() {
  const trackBtn = document.getElementById('track-job-info');
  
  // Show loading state
  trackBtn.textContent = 'Processing...';
  trackBtn.disabled = true;
  
  try {
    // Get values directly from form fields
    const jobInfo = {
      title: document.getElementById('job-title')?.value?.trim() || '',
      company: document.getElementById('company-name')?.value?.trim() || '',
      location: document.getElementById('job-location')?.value?.trim() || '',
      url: document.getElementById('job-url')?.value?.trim() || window.location.href,
      description: document.getElementById('job-description')?.value?.trim() || '',
      minSalary: document.getElementById('min-salary')?.value?.trim() || '',
      maxSalary: document.getElementById('max-salary')?.value?.trim() || ''
    };
    
    // Validate that we have at least title and company
    if (!jobInfo.title) {
      alert('Please enter a job title before tracking');
      return;
    }
    
    if (!jobInfo.company) {
      alert('Please enter a company name before tracking');
      return;
    }
    
    // Get priority for reminder creation
    const reminderPriority = parseInt(document.getElementById('reminder-priority')?.value) || 5;
    
    console.log('Job Extractor: Tracking job from form fields:', jobInfo);
    console.log('Job Extractor: Reminder priority:', reminderPriority);
    
    // Send JSON payload to extract functionality server-side
    const extractResponse = await chrome.runtime.sendMessage({
      action: 'extractFromJson',
      jobData: jobInfo,
      reminderPriority: reminderPriority
    });
    
    if (extractResponse.success) {
      console.log('✅ Successfully saved job data server-side:', extractResponse.jobId);
      
      // TEAL INTEGRATION COMMENTED OUT - Don't remove, just disabled
      /*
      // Conditionally open Teal tab based on checkbox state
      if (shouldTrackInTeal) {
        trackBtn.textContent = 'Opening Teal...';
        const tealResponse = await chrome.runtime.sendMessage({
          action: 'openTealAndFill',
          jobInfo: jobInfo
        });
        
        if (tealResponse.success) {
          console.log('✅ Successfully opened Teal tab with job information');
        } else {
          console.error('❌ Failed to open Teal:', tealResponse.error);
          alert(`Failed to open Teal: ${tealResponse.error}`);
        }
      } else {
        console.log('📝 Job data saved successfully (Teal tracking disabled)');
        alert('Job data saved successfully!');
      }
      */
      
      console.log('📝 Job data and reminder saved successfully!');
      alert('Job data and reminder saved successfully!');
    } else {
      console.error('❌ Failed to save job data:', extractResponse.error);
      alert(`Failed to save job data: ${extractResponse.error}`);
    }
    
  } catch (error) {
    console.error('Job Extractor: Track from form failed', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Reset button state
    trackBtn.textContent = 'Track';
    trackBtn.disabled = false;
  }
}

// Handle extract job functionality
async function handleExtractJob() {
  const extractBtn = document.getElementById('extract-job');
  const statusDiv = document.getElementById('extract-status');
  
  // Show loading state
  extractBtn.textContent = 'Extracting...';
  extractBtn.disabled = true;
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div class="loading">🚀 Running extraction...</div>';
  statusDiv.className = 'extract-status loading';
  
  try {
    // Send message to background script to execute CLI command
    const response = await chrome.runtime.sendMessage({
      action: 'extractJob',
      url: window.location.href
    });
    
    if (response.success) {
      statusDiv.innerHTML = `
        <div class="success-message">
          <span class="status-indicator success">✓</span>
          <strong>Success!</strong> Job extracted successfully
          <br><small>Job ID: ${response.jobId}</small>
          <br><small>Saved to: ${response.filePath}</small>
        </div>
      `;
      statusDiv.className = 'extract-status success';
      
      // Update the job description textarea if data is available
      if (response.jobData && response.jobData.description) {
        const textarea = document.getElementById('job-description');
        textarea.value = response.jobData.description;
        extractedJobDescription = response.jobData.description;
      }
      
    } else {
      statusDiv.innerHTML = `
        <div class="error-message">
          <span class="status-indicator error">✗</span>
          <strong>Error:</strong> ${response.error || 'Extraction failed'}
        </div>
      `;
      statusDiv.className = 'extract-status error';
    }
    
  } catch (error) {
    statusDiv.innerHTML = `
      <div class="error-message">
        <span class="status-indicator error">✗</span>
        <strong>Error:</strong> Failed to execute extraction
        <br><small>${error.message}</small>
      </div>
    `;
    statusDiv.className = 'extract-status error';
    console.error('Job Extractor: Extract job failed', error);
  }
  
  // Reset button state
  extractBtn.textContent = 'Extract';
  extractBtn.disabled = false;
  
  // Hide status after 5 seconds if successful
  if (statusDiv.className.includes('success')) {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}

// Analyze page content for questions
function analyzePageContent() {
  try {
    const questions = findQuestionsOnPage();
    const questionsDiv = document.getElementById('page-questions');
    const questionsList = document.getElementById('questions-list');
    
    if (questions.length > 0) {
      questionsList.innerHTML = '';
      questions.forEach(question => {
        const li = document.createElement('li');
        li.textContent = question;
        li.classList.add('clickable-question');
        li.addEventListener('click', function() {
          populateQuestionInput(question);
        });
        questionsList.appendChild(li);
      });
      questionsDiv.style.display = 'block';
      console.log(`Job Extractor: Found ${questions.length} questions on page`);
    } else {
      questionsDiv.style.display = 'none';
      console.log('Job Extractor: No questions found on page');
    }
  } catch (error) {
    console.error('Job Extractor: Error analyzing page content:', error);
  }
}

// Find questions on the current page
function findQuestionsOnPage() {
  const questions = [];
  const questionPatterns = [
    /\b[A-Z][^.!?]*\?/g, // Basic question pattern
    /What\s+[^?]+\?/gi,
    /How\s+[^?]+\?/gi,
    /Why\s+[^?]+\?/gi,
    /When\s+[^?]+\?/gi,
    /Where\s+[^?]+\?/gi,
    /Who\s+[^?]+\?/gi,
    /Which\s+[^?]+\?/gi,
    /Can\s+you\s+[^?]+\?/gi,
    /Do\s+you\s+[^?]+\?/gi,
    /Are\s+you\s+[^?]+\?/gi,
    /Have\s+you\s+[^?]+\?/gi,
    /Would\s+you\s+[^?]+\?/gi,
    /Could\s+you\s+[^?]+\?/gi
  ];
  
  // Get all text content from the page
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, span, div:not(script):not(style)');
  const seenQuestions = new Set();
  
  textElements.forEach(element => {
    // Skip our own extension content
    if (element.closest('#job-extractor-gutter')) return;
    
    const text = element.textContent || '';
    
    questionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanQuestion = match.trim();
          // Filter out very short questions, duplicates, and common non-questions
          if (cleanQuestion.length > 10 && 
              cleanQuestion.length < 200 && 
              !seenQuestions.has(cleanQuestion.toLowerCase()) &&
              !isCommonNonQuestion(cleanQuestion)) {
            questions.push(cleanQuestion);
            seenQuestions.add(cleanQuestion.toLowerCase());
          }
        });
      }
    });
  });
  
  // Limit to first 10 questions to avoid overwhelming the UI
  return questions.slice(0, 10);
}

// Filter out common patterns that aren't real questions
function isCommonNonQuestion(text) {
  const nonQuestionPatterns = [
    /^(what|how|why|when|where|who)\s*(is|are|was|were)?\s*$/i, // Too short
    /\b(username|password|email|phone|name|address)\b/i, // Form fields
    /\b(search|find|looking for)\b/i, // Search queries
    /^\s*\?\s*$/,  // Just question marks
    /\d+\s*\?\s*\d+/,  // Math expressions
    /\$\d+/,  // Price questions
    /\b(faq|q&a)\b/i  // FAQ headers
  ];
  
  return nonQuestionPatterns.some(pattern => pattern.test(text));
}

// Populate question into input field for user review
function populateQuestionInput(question) {
  const input = document.getElementById('llm-input');
  if (input) {
    input.value = question;
    input.focus();
    console.log('Job Extractor: Question populated into input:', question);
  }
}

// Generate CV-aware response using local MCP server
async function generateCVAwareResponse(query) {
  try {
    console.log('Job Extractor: Requesting CV-aware response for:', query);
    
    // Get current job description from textarea
    const jobDescriptionTextarea = document.getElementById('job-description');
    const jobDescription = jobDescriptionTextarea ? jobDescriptionTextarea.value.trim() : '';
    
    // Make request to local MCP server (through background script)
    const response = await chrome.runtime.sendMessage({
      action: 'callMCPServer',
      tool: 'answer_cv_question',
      args: { 
        question: query,
        jobDescription: jobDescription
      }
    });
    
    console.log('Job Extractor: Background response:', response);
    
    if (response && response.success && response.data) {
      console.log('Job Extractor: CV-aware response received:', response.data);
      return response.data;
    }
    
    console.log('Job Extractor: No CV-aware response available, falling back to mock');
    return null;
  } catch (error) {
    console.warn('Job Extractor: Failed to get CV-aware response:', error);
    return null;
  }
}

// Open the gutter
function openGutter() {
  if (isGutterOpen) return;
  
  createGutter();
  
  // Animate in
  setTimeout(() => {
    gutterElement.classList.add('open');
    document.body.classList.add('job-extractor-gutter-open');
    document.documentElement.classList.add('job-extractor-gutter-open');
    isGutterOpen = true;
  }, 10);
  
  console.log('Job Extractor: Gutter opened');
}

// Close the gutter
function closeGutter() {
  if (!isGutterOpen || !gutterElement) return;
  
  gutterElement.classList.remove('open');
  document.body.classList.remove('job-extractor-gutter-open');
  document.documentElement.classList.remove('job-extractor-gutter-open');
  
  setTimeout(() => {
    if (gutterElement && gutterElement.parentNode) {
      gutterElement.parentNode.removeChild(gutterElement);
      gutterElement = null;
    }
  }, 300);
  
  isGutterOpen = false;
  console.log('Job Extractor: Gutter closed');
}

// Toggle gutter
function toggleGutter() {
  if (isGutterOpen) {
    closeGutter();
  } else {
    openGutter();
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'toggleGutter':
      toggleGutter();
      sendResponse({
        success: true,
        isOpen: isGutterOpen
      });
      break;
      
    case 'getGutterState':
      sendResponse({
        isOpen: isGutterOpen
      });
      break;
      
    default:
      sendResponse({success: false, error: 'Unknown action'});
  }
});

// Keyboard shortcut (Ctrl+Shift+J or Cmd+Shift+J)
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
    e.preventDefault();
    if (jobExtractorEnabled) {
      toggleGutter();
    } else {
      console.log('Job Extractor Assistant is disabled. Use toggleJobExtractor(true) to enable.');
    }
  }
});

// LinkedIn connection extraction functionality
function detectLinkedInCompanyPeople() {
  const url = window.location.href;
  return url.includes('linkedin.com/company/') && url.includes('/people/');
}

function runLinkedInConnectionExtraction() {
  console.log("LinkedIn Connection Extractor - Starting profile clicks...");

  // Try multiple selectors to find LinkedIn profile cards
  var clickableElements = [];
  
  // Multiple selector patterns to try
  var selectorPatterns = [
    // Standard company people page
    ".org-people-profile-card a[href*='/in/']",
    ".org-people-profile-card__profile-info a[href*='/in/']",
    // Alternative patterns
    "[data-control-name='people_profile_card'] a[href*='/in/']",
    ".people-card a[href*='/in/']",
    ".entity-result a[href*='/in/']",
    // More generic LinkedIn profile links
    "a[href*='linkedin.com/in/']",
    "a[href*='/in/'][href*='linkedin']"
  ];
  
  // Track unique URLs to avoid duplicates
  var seenUrls = new Set();
  
  // Try each selector pattern
  for (let pattern of selectorPatterns) {
    var foundElements = document.querySelectorAll(pattern);
    console.log(`Trying selector "${pattern}": found ${foundElements.length} elements`);
    
    if (foundElements.length > 0) {
      for (let i = 0; i < foundElements.length; i++) {
        var profileLink = foundElements[i];
        var profileUrl = profileLink.href;
        
        // Skip if we've already seen this URL
        if (seenUrls.has(profileUrl)) {
          continue;
        }
        seenUrls.add(profileUrl);
        
        var card = profileLink.closest('.org-people-profile-card, .entity-result, .people-card, [data-control-name="people_profile_card"]');
        
        var nameElement = card ? card.querySelector('.t-black, .entity-result__title-text, .t-16, .t-bold') : null;
        var headlineElement = card ? card.querySelector('.t-14, .entity-result__primary-subtitle, .t-12') : null;
        
        var name = nameElement ? nameElement.innerText.trim() : `Profile ${clickableElements.length + 1}`;
        var headline = headlineElement ? headlineElement.innerText.trim() : "";
        
        console.log(`Found unique connection: ${name} - ${headline}`);
        clickableElements.push({
            element: profileLink,
            name: name,
            headline: headline
        });
      }
      break; // Stop trying other patterns if we found some elements
    }
  }

  console.log(`Found ${clickableElements.length} connection profiles.`);

  // Open all profiles with delays
  if (clickableElements.length > 0) {
      // Ask user for confirmation before opening all profiles
      var confirmMessage = `Found ${clickableElements.length} connection profiles.\n\nClick OK to open all profiles in new tabs, or Cancel to skip.`;
      var userConfirmed = confirm(confirmMessage);
      
      if (!userConfirmed) {
          console.log('User cancelled profile opening');
          linkedInExtractionRunning = false; // Reset flag when cancelled
          return;
      }
      
      console.log(`Opening ${clickableElements.length} profiles with random delays...`);
      
      function openProfilesWithDelay(elements, index = 0) {
          if (index >= elements.length) {
              console.log("Finished opening all connection profiles!");
              linkedInExtractionRunning = false; // Reset flag when done
              return;
          }
          
          // Random delay between 1500-3000ms
          var delay = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
          
          setTimeout(() => {
              var connection = elements[index];
              console.log(`Opening profile ${index + 1}/${elements.length} in new tab: ${connection.name}`);
              
              // Open in new tab
              window.open(connection.element.href, '_blank');
              
              // Continue with next profile
              openProfilesWithDelay(elements, index + 1);
          }, delay);
      }
      
      // Start opening all profiles
      openProfilesWithDelay(clickableElements);
  } else {
      console.log("No clickable connection profiles found with any selector pattern.");
      console.log("Available elements on page:");
      // Debug: log what elements are actually on the page
      var allLinks = document.querySelectorAll('a[href*="linkedin.com"], a[href*="/in/"]');
      console.log(`Found ${allLinks.length} LinkedIn-related links total`);
      linkedInExtractionRunning = false; // Reset flag if no elements found
  }
}

// Auto-detect LinkedIn company people pages and run extraction
function checkForLinkedInExtraction() {
  if (detectLinkedInCompanyPeople()) {
    // Auto-enable Job Extractor when on LinkedIn company people page (outreach command)
    if (!jobExtractorEnabled) {
      jobExtractorEnabled = true;
      console.log('🔄 Job Extractor Assistant automatically enabled for outreach command');
    }
    
    if (!linkedInExtractionRunning) {
      linkedInExtractionRunning = true;
      // Clear previous session's prompted profiles when starting fresh extraction
      promptedProfiles.clear();
      console.log('Cleared previous prompt tracking for fresh session');
      console.log('LinkedIn company people page detected - waiting 5 seconds before extraction...');
      function startExtraction() {
        runLinkedInConnectionExtraction();
      }
      setTimeout(startExtraction, 5000);
    }
  }
}

// Run check when page loads - handle multiple scenarios
if (document.readyState === 'loading') {
  // DOM is still loading
  document.addEventListener('DOMContentLoaded', checkForLinkedInExtraction);
} else {
  // DOM is already loaded
  checkForLinkedInExtraction();
}

// Also listen for window load event as fallback
window.addEventListener('load', checkForLinkedInExtraction);

// Also run check when URL changes (for SPA navigation)
let currentUrl = window.location.href;
function checkUrlChange() {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    function delayedCheck() {
      checkForLinkedInExtraction();
      checkForLinkedInFeed(); // Also check for feed page
    }
    setTimeout(delayedCheck, 1000); // Wait for page content to load
  }
}
setInterval(checkUrlChange, 1000);

// Run initial check immediately in case we missed the load events
checkForLinkedInExtraction();

// LinkedIn Profile Mutual Connections Handler
function detectLinkedInProfile() {
  const url = window.location.href;
  return url.includes('linkedin.com/in/');
}

function findAndClickMutualConnections() {
  console.log('Looking for mutual connections link...');
  
  // Don't run on search results pages
  if (window.location.href.includes('/search/results/')) {
    console.log('Skipping mutual connections search - already on search results page');
    return;
  }
  
  // Get the current profile person's name from the page
  var profileName = getProfilePersonName();
  console.log(`Profile person name: "${profileName}"`);
  
  // If we're getting "Unknown Profile", let's debug what's available on the page
  if (profileName === 'Unknown Profile') {
    console.log('Profile name detection failed, debugging available elements:');
    
    // Check all h1 elements
    var allH1s = document.querySelectorAll('h1');
    console.log(`Found ${allH1s.length} h1 elements:`);
    allH1s.forEach((h1, index) => {
      console.log(`  H1 ${index}: "${h1.innerText.trim()}" (classes: ${h1.className})`);
    });
    
    // Check page title
    console.log(`Document title: "${document.title}"`);
    
    // Check for text-heading-xlarge specifically
    var headingElements = document.querySelectorAll('.text-heading-xlarge');
    console.log(`Found ${headingElements.length} .text-heading-xlarge elements:`);
    headingElements.forEach((el, index) => {
      console.log(`  Heading ${index}: "${el.innerText.trim()}"`);
    });
    
    // Check ALL elements with text that might contain names
    var allTextElements = document.querySelectorAll('h1, h2, .pv-text-details__left-panel *, .top-card *, [data-test-id*="name"] *, [data-anonymize="person-name"]');
    console.log(`Found ${allTextElements.length} potential name elements:`);
    allTextElements.forEach((el, index) => {
      var text = el.innerText ? el.innerText.trim() : '';
      if (text.length > 0 && text.length < 100) {
        console.log(`  Element ${index}: "${text}" (tag: ${el.tagName}, classes: ${el.className})`);
      }
    });
  }
  
  // Look specifically for the main mutual connections link, not individual connection links
  var mutualConnectionLink = null;
  
  // Find elements that contain mutual connections text - be more specific
  var textElements = document.querySelectorAll('span.t-normal, span.hoverable-link-text');
  for (let textElement of textElements) {
    var text = textElement.innerText || textElement.textContent || '';
    // Look for text that says "X other mutual connections" or "and X other mutual connections"
    if (text.includes('mutual connection') && text.includes('other')) {
      // Found text like "Dawn Ho, Robert Monarch, and 5 other mutual connections"
      var linkElement = textElement.closest('a');
      if (linkElement && linkElement.href && linkElement.href.includes('facetConnectionOf')) {
        // Double check this isn't clicking on a name within the text
        var linkText = linkElement.innerText || linkElement.textContent || '';
        if (linkText.includes('other mutual connection')) {
          mutualConnectionLink = linkElement;
          console.log(`Found mutual connections link with full text: "${linkText.trim()}"`);
          console.log(`Link href: ${linkElement.href}`);
          break;
        }
      }
    }
  }
  
  // More specific fallback: look for the exact pattern
  if (!mutualConnectionLink) {
    var allLinks = document.querySelectorAll('a[href*="facetConnectionOf"]');
    console.log(`Found ${allLinks.length} links with facetConnectionOf`);
    
    for (let link of allLinks) {
      var linkText = link.innerText || link.textContent || '';
      console.log(`Checking link: "${linkText.trim()}" -> ${link.href}`);
      
      // Make sure it contains the full mutual connections text and not just a name
      if (linkText.includes('mutual connection') && linkText.includes('other') && !link.href.includes('/in/')) {
        mutualConnectionLink = link;
        console.log(`Selected mutual connections link: "${linkText.trim()}"`);
        break;
      }
    }
  }
  
  // Final fallback: find the link that has the most complete mutual connections text
  if (!mutualConnectionLink) {
    console.log('Using final fallback to find mutual connections link...');
    var allLinks = document.querySelectorAll('a[href*="facetConnectionOf"]');
    var bestLink = null;
    var maxNames = 0;
    
    for (let link of allLinks) {
      if (!link.href.includes('/in/')) {
        var linkText = link.innerText || link.textContent || '';
        // Count how many names are in the text (commas + 1)
        var nameCount = (linkText.match(/,/g) || []).length + 1;
        if (nameCount > maxNames && linkText.includes('mutual')) {
          maxNames = nameCount;
          bestLink = link;
          console.log(`Better link found with ${nameCount} names: "${linkText.trim()}"`);
        }
      }
    }
    
    mutualConnectionLink = bestLink;
    if (mutualConnectionLink) {
      console.log(`Final selected link: "${mutualConnectionLink.innerText.trim()}"`);
    }
  }
  
  if (mutualConnectionLink) {
    console.log('Found mutual connections link, clicking...');
    console.log(`Link URL: ${mutualConnectionLink.href}`);
    
    // Check if we've already prompted for this profile
    var currentUrl = window.location.href;
    if (promptedProfiles.has(currentUrl)) {
      console.log('Already prompted for this profile, skipping confirmation');
      return;
    }
    
    // Ask user for confirmation before proceeding
    var confirmMessage = `Found mutual connections for this profile.\n\nClick OK to extract mutual connections data, or Cancel to skip.`;
    var userConfirmed = confirm(confirmMessage);
    
    // Mark this profile as prompted regardless of user choice
    promptedProfiles.add(currentUrl);
    
    if (!userConfirmed) {
      console.log('User cancelled mutual connections extraction');
      return;
    }
    
    console.log('User confirmed - proceeding with mutual connections extraction');
    
    // Store the profile person's name and URL in localStorage for persistence across page navigation
    console.log(`Storing in localStorage - URL: "${currentUrl}", Name: "${profileName}"`);
    
    // Ensure we store the actual name, not "Unknown Profile"
    var nameToStore = profileName;
    if (profileName === 'Unknown Profile') {
      // Try to extract name from URL as fallback during storage
      var urlMatch = currentUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (urlMatch) {
        var urlSlug = urlMatch[1];
        nameToStore = urlSlug
          .replace(/-/g, ' ')
          .replace(/\d+/g, '')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        console.log(`Using URL-extracted name for storage: "${nameToStore}"`);
      }
    }
    
    localStorage.setItem('linkedin_target_profile_url', currentUrl);
    localStorage.setItem('linkedin_target_profile_name', nameToStore);
    localStorage.setItem('linkedin_extraction_timestamp', Date.now().toString());
    
    // Verify storage worked
    console.log(`Verification - stored name: "${localStorage.getItem('linkedin_target_profile_name')}"`);
    console.log(`Verification - stored URL: "${localStorage.getItem('linkedin_target_profile_url')}"`);
    
    mutualConnectionLink.click();
    
    // Don't set up extraction timer here - it will be handled by the URL change detection
  } else {
    console.log('No mutual connections link found on this profile');
  }
}

// Helper function to get the profile person's name from the profile page
function getProfilePersonName() {
  try {
    // Try multiple selectors for the profile name
    var nameSelectors = [
      'h1.inline.t-24.v-align-middle.break-words',  // New LinkedIn profile name selector
      'h1[class*="inline"][class*="t-24"][class*="v-align-middle"][class*="break-words"]', // Fallback for dynamic classes
      '.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      '.top-card-layout__title',
      'h1[data-anonymize="person-name"]',
      '.top-card__title',
      '.ph5 .text-heading-xlarge',
      '.pv-text-details__left-panel .text-heading-xlarge'
    ];
    
    for (let selector of nameSelectors) {
      var nameElement = document.querySelector(selector);
      if (nameElement && nameElement.innerText.trim()) {
        var name = nameElement.innerText.trim();
        console.log(`Found potential name with selector "${selector}": "${name}"`);
        // Less restrictive filtering - just avoid obvious non-names
        if (!name.toLowerCase().includes('search') && 
            !name.toLowerCase().includes('results') && 
            name.length > 2 && 
            !name.match(/^\(\d+\)/)) {
          return name;
        }
      }
    }
    
    // Fallback: try to get from page title, but clean it up
    var pageTitle = document.title;
    console.log(`Page title: "${pageTitle}"`);
    var titleMatch = pageTitle.match(/^([^|(-]+)/);
    if (titleMatch) {
      var name = titleMatch[1].trim();
      console.log(`Extracted from title: "${name}"`);
      // Less restrictive filtering
      if (!name.toLowerCase().includes('search') && 
          !name.toLowerCase().includes('results') && 
          name.length > 2) {
        return name;
      }
    }
    
    // Final fallback: extract name from URL
    var currentUrl = window.location.href;
    var urlMatch = currentUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (urlMatch) {
      var urlSlug = urlMatch[1];
      // Convert URL slug to readable name
      var nameFromUrl = urlSlug
        .replace(/-/g, ' ')           // Replace hyphens with spaces
        .replace(/\d+/g, '')         // Remove numbers
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
        .join(' ');
      
      console.log(`Extracted from URL: "${nameFromUrl}"`);
      if (nameFromUrl.length > 2) {
        return nameFromUrl;
      }
    }
    
    return 'Unknown Profile';
  } catch (error) {
    console.log('Could not determine profile person name:', error);
    return 'Unknown Profile';
  }
}

function extractMutualConnectionNames() {
  console.log('Extracting mutual connection names...');
  
  try {
    // Get the target profile URL from localStorage 
    var targetProfileUrl = localStorage.getItem('linkedin_target_profile_url') || '';
    console.log(`Target profile URL: "${targetProfileUrl}"`);
    
    // Extract first name directly from the URL
    var targetFirstName = 'Unknown';
    if (targetProfileUrl) {
      var urlMatch = targetProfileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (urlMatch) {
        var urlSlug = urlMatch[1];
        // Convert URL slug to first name: "samuel-bigio-42918b128" -> "Samuel"
        var firstName = urlSlug
          .split('-')[0]                    // Get first part before hyphens
          .replace(/\d+/g, '')             // Remove any numbers
          .trim();
        
        if (firstName.length > 0) {
          targetFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        }
      }
    }
    
    console.log(`Extracted first name from URL: "${targetFirstName}"`);
    
    // Extract mutual connections
    var identifier = document.querySelectorAll('div.mb1 a')[0]?.className.trim();
    if (!identifier) {
      console.log('Could not find identifier for mutual connections');
      return;
    }
    
    var result = 'Full,PersonName,PersonURL\n'; // CSV headers
    var selector = '.t-16 a.' + identifier + '>span>span:not(.visually-hidden)';
    var nameElements = document.querySelectorAll(selector);
    
    nameElements.forEach((element) => {
      var mutualConnectionName = element.innerText.trim();
      if (mutualConnectionName) {
        // Output format: mutual connection full name, target profile first name, target profile URL
        var csvRow = `"${mutualConnectionName}","${targetFirstName}","${targetProfileUrl}"`;
        result += csvRow + '\n';
      }
    });
    
    if (nameElements.length > 0) {
      console.log('Complete CSV output:');
      console.log(result);
    }
    
  } catch (error) {
    console.error('Error extracting mutual connection names:', error);
  }
}

// Helper function to get the connection person's name
function getConnectionPersonName() {
  try {
    // Try to get from URL parameters first
    var urlParams = new URLSearchParams(window.location.search);
    var connectionId = urlParams.get('facetConnectionOf');
    
    // Try to get from the page breadcrumb or title
    var breadcrumbElement = document.querySelector('.search-results-container h1, .search-results__title');
    if (breadcrumbElement) {
      var titleText = breadcrumbElement.innerText;
      // Extract name from text like "People connected to John Doe"
      var nameMatch = titleText.match(/connected to (.+?)(?:\s|$)/i);
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
    
    // Fallback: try to get from previous page context (if available)
    if (window.previousConnectionName) {
      return window.previousConnectionName;
    }
    
    return 'Unknown Connection';
  } catch (error) {
    console.log('Could not determine connection person name:', error);
    return 'Unknown Connection';
  }
}

// Auto-detect LinkedIn profile pages and find mutual connections
function checkForLinkedInProfile() {
  if (!jobExtractorEnabled) {
    return; // Skip if disabled
  }
  
  // Only run on individual profile pages, NOT on company people pages or search results pages
  var url = window.location.href;
  var isProfilePage = url.includes('linkedin.com/in/');
  var isCompanyPage = detectLinkedInCompanyPeople();
  var isSearchPage = url.includes('/search/results/');
  
  console.log(`checkForLinkedInProfile: isProfilePage=${isProfilePage}, isCompanyPage=${isCompanyPage}, isSearchPage=${isSearchPage}`);
  
  if (isProfilePage && !isCompanyPage && !isSearchPage) {
    console.log('LinkedIn profile page detected - waiting 5 seconds before looking for mutual connections...');
    searchPageProcessed = false; // Reset for new profile
    setTimeout(() => {
      findAndClickMutualConnections();
    }, 5000);
  } else if (isSearchPage && url.includes('facetConnectionOf') && !searchPageProcessed) {
    // This is a mutual connections search page - just extract the data ONCE
    console.log('LinkedIn mutual connections search page detected - waiting 4 seconds before extracting...');
    searchPageProcessed = true;
    setTimeout(() => {
      extractMutualConnectionNames();
    }, 4000);
  }
}

// Listen for messages from company people page
window.addEventListener('message', function(event) {
  if (event.data.action === 'detectMutualConnections') {
    console.log(`Received request to detect mutual connections for: ${event.data.profileName}`);
    checkForLinkedInProfile();
  }
});

// Also run profile check when page loads  
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForLinkedInProfile);
} else {
  checkForLinkedInProfile();
}

window.addEventListener('load', checkForLinkedInProfile);

// Monitor URL changes for profile pages too
let profileCurrentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== profileCurrentUrl) {
    profileCurrentUrl = window.location.href;
    setTimeout(checkForLinkedInProfile, 1000);
  }
}, 1000);


// LinkedIn Feed Post Save Detection
function detectLinkedInFeed() {
  const url = window.location.href;
  return url.includes('linkedin.com/feed');
}

function initLinkedInFeedMonitoring() {
  if (!detectLinkedInFeed()) {
    console.log('LinkedIn Feed: Not on feed page, skipping monitoring');
    return;
  }
  
  console.log('LinkedIn Feed: ✅ Monitoring for post saves activated!');
  
  // Monitor for save button clicks using event delegation
  document.addEventListener('click', handleLinkedInFeedClick, true);
  
  // Also monitor for DOM changes to catch dynamically added content
  const observer = new MutationObserver(handleLinkedInFeedMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'class']
  });
}

function handleLinkedInFeedClick(event) {
  const target = event.target;
  
  // Debug: Log all clicks on LinkedIn feed (temporary)
  if (target.tagName === 'BUTTON' || target.closest('button')) {
    console.log('LinkedIn Feed: Button clicked:', {
      tagName: target.tagName,
      className: target.className,
      ariaLabel: target.getAttribute('aria-label'),
      innerHTML: target.innerHTML.substring(0, 100),
      closest: target.closest('button')?.getAttribute('aria-label')
    });
  }
  
  // Check if this is a save/bookmark button
  if (isLinkedInSaveButton(target)) {
    console.log('LinkedIn Feed: 🎯 Save button detected!', target);
    
    // Small delay to let LinkedIn process the save
    setTimeout(() => {
      const postElement = findPostElement(target);
      if (postElement) {
        console.log('LinkedIn Feed: Found post element, extracting info...');
        extractAndCreateReminderFromPost(postElement);
      } else {
        console.log('LinkedIn Feed: ❌ Could not find post element for save button');
      }
    }, 500);
  }
}

function handleLinkedInFeedMutations(mutations) {
  mutations.forEach(mutation => {
    // Look for save button state changes (when posts get saved)
    if (mutation.type === 'attributes' && 
        mutation.attributeName === 'aria-pressed' && 
        mutation.target.getAttribute('aria-pressed') === 'true') {
      
      if (isLinkedInSaveButton(mutation.target)) {
        console.log('LinkedIn Feed: Post saved via state change!', mutation.target);
        
        const postElement = findPostElement(mutation.target);
        if (postElement) {
          extractAndCreateReminderFromPost(postElement);
        }
      }
    }
  });
}

function isLinkedInSaveButton(element) {
  if (!element) return false;
  
  // Get the button element (might be nested)
  const buttonElement = element.tagName === 'BUTTON' ? element : element.closest('button');
  if (!buttonElement) return false;
  
  // Check for save button indicators
  const ariaLabel = buttonElement.getAttribute('aria-label')?.toLowerCase() || '';
  const dataControlName = buttonElement.getAttribute('data-control-name')?.toLowerCase() || '';
  const className = buttonElement.className?.toLowerCase() || '';
  
  // Common save button patterns
  const savePatterns = [
    'save',
    'bookmark',
    'save post',
    'save article',
    'save this post'
  ];
  
  // Check aria-label
  if (savePatterns.some(pattern => ariaLabel.includes(pattern))) {
    console.log('LinkedIn Feed: Save button detected via aria-label:', ariaLabel);
    return true;
  }
  
  // Check data-control-name
  if (savePatterns.some(pattern => dataControlName.includes(pattern))) {
    console.log('LinkedIn Feed: Save button detected via data-control-name:', dataControlName);
    return true;
  }
  
  // Check for bookmark/save icons in SVG
  const svgElement = buttonElement.querySelector('svg');
  if (svgElement) {
    const svgContent = svgElement.innerHTML.toLowerCase();
    if (svgContent.includes('bookmark') || svgContent.includes('save')) {
      console.log('LinkedIn Feed: Save button detected via SVG content');
      return true;
    }
  }
  
  // Check button inner text
  const buttonText = buttonElement.textContent?.toLowerCase() || '';
  if (savePatterns.some(pattern => buttonText.includes(pattern))) {
    console.log('LinkedIn Feed: Save button detected via button text:', buttonText);
    return true;
  }
  
  return false;
}

function findPostElement(saveButton) {
  // LinkedIn posts are typically in containers with these selectors
  const postSelectors = [
    '.feed-shared-update-v2',
    '.occludable-update',
    '[data-urn*="activity"]',
    '.feed-shared-update'
  ];
  
  for (const selector of postSelectors) {
    const postElement = saveButton.closest(selector);
    if (postElement) {
      return postElement;
    }
  }
  
  return null;
}

async function extractAndCreateReminderFromPost(postElement) {
  try {
    console.log('LinkedIn Feed: Extracting post information...');
    
    const postInfo = extractLinkedInPostInfo(postElement);
    
    if (postInfo.author && postInfo.content) {
      console.log('LinkedIn Feed: Creating reminder for saved post...', postInfo);
      
      // Create reminder via background script
      const response = await chrome.runtime.sendMessage({
        action: 'createLinkedInPostReminder',
        postInfo: postInfo
      });
      
      if (response && response.success) {
        console.log('LinkedIn Feed: ✅ Reminder created successfully!');
        showLinkedInFeedNotification('📌 Reminder created for saved post');
      } else {
        console.log('LinkedIn Feed: ❌ Failed to create reminder:', response?.error);
      }
    } else {
      console.log('LinkedIn Feed: ⚠️ Could not extract enough post information');
    }
  } catch (error) {
    console.error('LinkedIn Feed: Error creating reminder:', error);
  }
}

function extractLinkedInPostInfo(postElement) {
  const postInfo = {
    author: '',
    title: '',
    content: '',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    postId: ''
  };
  
  try {
    // Extract author name
    const authorSelectors = [
      '.feed-shared-actor__name',
      '.feed-shared-actor__title',
      '.update-components-actor__name',
      '[data-urn*="person"] span[aria-hidden="true"]'
    ];
    
    for (const selector of authorSelectors) {
      const authorElement = postElement.querySelector(selector);
      if (authorElement && authorElement.textContent.trim()) {
        postInfo.author = authorElement.textContent.trim();
        break;
      }
    }
    
    // Extract post content
    const contentSelectors = [
      '.feed-shared-text',
      '.feed-shared-inline-show-more-text',
      '.update-components-text',
      '.feed-shared-update-v2__description'
    ];
    
    for (const selector of contentSelectors) {
      const contentElement = postElement.querySelector(selector);
      if (contentElement && contentElement.textContent.trim()) {
        postInfo.content = contentElement.textContent.trim().substring(0, 500); // Limit length
        break;
      }
    }
    
    // Extract post ID from data attributes
    const urnElement = postElement.querySelector('[data-urn]') || postElement;
    if (urnElement.dataset.urn) {
      postInfo.postId = urnElement.dataset.urn;
    }
    
    // Create a title from author and content preview
    if (postInfo.author && postInfo.content) {
      const contentPreview = postInfo.content.substring(0, 50) + (postInfo.content.length > 50 ? '...' : '');
      postInfo.title = `LinkedIn post by ${postInfo.author}: ${contentPreview}`;
    } else if (postInfo.author) {
      postInfo.title = `LinkedIn post by ${postInfo.author}`;
    }
    
    console.log('LinkedIn Feed: Extracted post info:', postInfo);
    return postInfo;
    
  } catch (error) {
    console.error('LinkedIn Feed: Error extracting post info:', error);
    return postInfo;
  }
}

function showLinkedInFeedNotification(message) {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #0a66c2;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    max-width: 300px;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Initialize LinkedIn feed monitoring when on feed page
function checkForLinkedInFeed() {
  if (detectLinkedInFeed()) {
    initLinkedInFeedMonitoring();
  }
}

// Run feed check on load and URL changes
checkForLinkedInFeed();

console.log('Job Extractor Assistant: Content script loaded');
console.log('💡 Console functions available:');
console.log('  • toggleJobExtractor(true/false) - Enable/disable automation');
console.log('  • getJobExtractorStatus() - Check current status');
console.log('💡 LinkedIn Feed: Post save monitoring active on linkedin.com/feed');
console.log('');
console.log('📋 For mutual connections extraction, copy/paste this function:');
console.log(`
function extractCurrentPage() {
  try {
    var targetProfileUrl = localStorage.getItem('linkedin_target_profile_url') || '';
    console.log('Target profile URL: "' + targetProfileUrl + '"');
    
    var targetFirstName = 'Unknown';
    if (targetProfileUrl) {
      var urlMatch = targetProfileUrl.match(/linkedin\\.com\\/in\\/([^\\/\\?]+)/);
      if (urlMatch) {
        var urlSlug = urlMatch[1];
        var firstName = urlSlug.split('-')[0].replace(/\\d+/g, '').trim();
        if (firstName.length > 0) {
          targetFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        }
      }
    }
    
    console.log('Extracted first name from URL: "' + targetFirstName + '"');
    
    var identifier = document.querySelectorAll('div.mb1 a')[0]?.className.trim();
    if (!identifier) {
      console.log('Could not find identifier for mutual connections on this page');
      return null;
    }
    
    var result = 'Full,PersonName,PersonURL\\n';
    var selector = '.t-16 a.' + identifier + '>span>span:not(.visually-hidden)';
    var nameElements = document.querySelectorAll(selector);
    
    nameElements.forEach(function(element) {
      var mutualConnectionName = element.innerText.trim();
      if (mutualConnectionName) {
        var csvRow = '"' + mutualConnectionName + '","' + targetFirstName + '","' + targetProfileUrl + '"';
        result += csvRow + '\\n';
      }
    });
    
    if (nameElements.length > 0) {
      console.log('Complete CSV output:');
      console.log(result);
      return result;
    } else {
      console.log('No mutual connection names found on current page');
      return null;
    }
  } catch (error) {
    console.error('Error extracting mutual connections:', error);
    return null;
  }
}
`);

// Debug: Verify functions are available
console.log('🔧 Functions loaded:', {
  toggleJobExtractor: typeof window.toggleJobExtractor,
  getJobExtractorStatus: typeof window.getJobExtractorStatus,
  extractCurrentPage: typeof window.extractCurrentPage
});

// Simple workaround - just expose the function using a different method
// Since CSP blocks inline scripts, let's use a simpler approach
console.log('🔧 Setting up extractCurrentPage() via DOM event...');

// Create a global function that can be called from console
window.addEventListener('message', function(event) {
  if (event.data.action === 'extractCurrentPage' && event.source === window) {
    // Call the extraction function from content script context
    const result = window.extractCurrentPage();
    // Post result back
    console.log('📤 Extraction result:', result);
  }
});

// Override console to intercept extractCurrentPage calls
const originalLog = console.log;
let extractCurrentPageOverride = null;

// Create a simple workaround by monitoring console commands
Object.defineProperty(window, 'extractCurrentPage', {
  get: function() {
    if (!extractCurrentPageOverride) {
      extractCurrentPageOverride = function() {
        console.log('🔄 Running extractCurrentPage from content script...');
        
        try {
          // Get the target profile URL from localStorage 
          var targetProfileUrl = localStorage.getItem('linkedin_target_profile_url') || '';
          console.log(`Target profile URL: "${targetProfileUrl}"`);
          
          // Extract first name directly from the URL
          var targetFirstName = 'Unknown';
          if (targetProfileUrl) {
            var urlMatch = targetProfileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
            if (urlMatch) {
              var urlSlug = urlMatch[1];
              // Convert URL slug to first name: "seldo" -> "Seldo"
              var firstName = urlSlug
                .split('-')[0]                    // Get first part before hyphens
                .replace(/\d+/g, '')             // Remove any numbers
                .trim();
              
              if (firstName.length > 0) {
                targetFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
              }
            }
          }
          
          console.log(`Extracted first name from URL: "${targetFirstName}"`);
          
          // Extract mutual connections
          var identifier = document.querySelectorAll('div.mb1 a')[0]?.className.trim();
          if (!identifier) {
            console.log('Could not find identifier for mutual connections on this page');
            return null;
          }
          
          var result = 'Full,PersonName,PersonURL\n'; // CSV headers
          var selector = '.t-16 a.' + identifier + '>span>span:not(.visually-hidden)';
          var nameElements = document.querySelectorAll(selector);
          
          nameElements.forEach((element) => {
            var mutualConnectionName = element.innerText.trim();
            if (mutualConnectionName) {
              // Output format: mutual connection full name, target profile first name, target profile URL
              var csvRow = `"${mutualConnectionName}","${targetFirstName}","${targetProfileUrl}"`;
              result += csvRow + '\n';
            }
          });
          
          if (nameElements.length > 0) {
            console.log('Complete CSV output:');
            console.log(result);
            return result;
          } else {
            console.log('No mutual connection names found on current page');
            return null;
          }
          
        } catch (error) {
          console.error('Error extracting mutual connections from current page:', error);
          return null;
        }
      };
    }
    return extractCurrentPageOverride;
  },
  configurable: true
});

console.log('✅ extractCurrentPage() accessible via property override');