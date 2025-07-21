// content.js
console.log("Amazon Review Filter content script loaded.");

const FLASK_ENDPOINT = 'http://127.0.0.1:5000/analyze_review';

// Thresholds for individual high probabilities that make a review FAKE for blocking
const FAKE_PROB_ALONE_BLOCK_THRESHOLD = 0.75; // If fakeProbability is 75% or higher, it's FAKE
const AI_PROB_ALONE_BLOCK_THRESHOLD = 0.75;   // If aiProbability is 75% or higher, it's FAKE

// Threshold for combined probabilities that make a review FAKE for blocking
const COMBINED_PROB_BLOCK_THRESHOLD = 0.50; // If BOTH fake AND AI are 50% or higher, it's FAKE

// Threshold for simply displaying 'AI-WRITTEN' status (can be different from blocking threshold)
const AI_DISPLAY_THRESHOLD = 0.60;

let blockedReviewCount = 0; // Initialize counter for this page load

// --- Site-Specific Selectors and Functions ---
const siteConfigs = {
    'amazon.com': {
        reviewContainerSelector: '[data-hook="review"]', // The entire review block
        reviewTextSelector: '.review-text-content span', // The actual review text element
        // Elements to hide within the container when a review is blocked
        elementsToHideSelectors: ['.review-text-content', '.a-section.review-header', '.review-data', '.review-time'],
        // Function to get the review container for a given text element
        getReviewContainer: (reviewTextElement) => {
            let currentElement = reviewTextElement;
            while (currentElement && currentElement !== document.body) {
                if (currentElement.matches('[data-hook="review"]') || currentElement.classList.contains('review')) {
                    return currentElement;
                }
                currentElement = currentElement.parentElement;
            }
            return null;
        }
    }
};

function getCurrentSiteConfig() {
    const hostname = window.location.hostname;
    if (hostname.includes('amazon.com')) {
        return siteConfigs['amazon.com'];
    }
    return null; // Not on a supported site
}

// --- Main Processing Logic ---
async function processAndFilterReviews(filterEnabled) {
    const config = getCurrentSiteConfig();
    if (!config) {
        console.log("Not on a supported Amazon page. Skipping review processing.");
        blockedReviewCount = 0;
        chrome.runtime.sendMessage({ action: "updateBlockedCount", count: blockedReviewCount });
        return;
    }

    const warningDiv = document.getElementById('temu-model-warning');
    if (warningDiv) warningDiv.style.display = 'none'; 


    console.log("Processing and filtering reviews. Filter enabled:", filterEnabled, "Site:", window.location.hostname);
    blockedReviewCount = 0; // Reset counter for a new analysis run
    const reviewTextElements = document.querySelectorAll(config.reviewTextSelector);
    const processedReviewIds = new Set(); 

    // Step 1: Manage visibility and messages for ALL reviews based on current filter state
    document.querySelectorAll(config.reviewContainerSelector).forEach(reviewContainer => {
        let blockedMessageDiv = reviewContainer.querySelector('.fake-review-blocked-message');
        if (!blockedMessageDiv) {
            blockedMessageDiv = document.createElement('div');
            blockedMessageDiv.classList.add('fake-review-blocked-message');
            blockedMessageDiv.style.cssText = `
                color: #C45500; font-weight: bold; padding: 10px;
                background-color: #FFF8E1; border: 1px solid #FFD180;
                border-radius: 5px; margin-top: 10px; text-align: center;
            `;
            blockedMessageDiv.textContent = 'FAKE REVIEW BLOCKED';
            reviewContainer.prepend(blockedMessageDiv); 
            blockedMessageDiv.style.display = 'none'; // Hidden by default
        }

        const isCurrentlyFake = reviewContainer.classList.contains('fake-review-detected');

        if (isCurrentlyFake && filterEnabled) {
            // If detected as fake and filter is ON, hide content, show message
            config.elementsToHideSelectors.forEach(selector => {
                reviewContainer.querySelectorAll(selector).forEach(el => el.style.display = 'none');
            });
            blockedMessageDiv.style.display = ''; // Show message
            blockedReviewCount++; // Increment count only if actually hiding
        } else {
            // If not fake, or filter is OFF, show content, hide message
            config.elementsToHideSelectors.forEach(selector => {
                reviewContainer.querySelectorAll(selector).forEach(el => el.style.display = '');
            });
            blockedMessageDiv.style.display = 'none'; // Hide message
        }
    });

    // Step 2: Analyze new reviews or re-analyze if necessary
    for (const el of reviewTextElements) {
        const reviewText = el.innerText.trim();
        const reviewContainer = config.getReviewContainer(el);

        if (!reviewText || !reviewContainer) {
            continue;
        }

        const reviewId = reviewContainer.id || Array.from(reviewContainer.classList).join(' ') + reviewText.substring(0, Math.min(reviewText.length, 50)); 
        if (processedReviewIds.has(reviewId)) {
            continue; // Skip if already processed in this run
        }
        processedReviewIds.add(reviewId);

        // Skip ML analysis if already detected and marked from a previous run
        if (reviewContainer.classList.contains('review-processed-by-ml')) {
             continue;
        }
        
        try {
            const response = await fetch(FLASK_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reviewText: reviewText })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Analysis result for review (first 50 chars):", reviewText.substring(0,50), "...", data);

            // NEW COMPLEX LOGIC: Determine if the review is FAKE for blocking
            const isReviewFake = (data.fakeProbability >= FAKE_PROB_ALONE_BLOCK_THRESHOLD) || // Case 1: Fake prob alone is high
                                 (data.aiProbability >= AI_PROB_ALONE_BLOCK_THRESHOLD) ||     // Case 2: AI prob alone is high
                                 (data.fakeProbability >= COMBINED_PROB_BLOCK_THRESHOLD &&    // Case 3: Both are above 50%
                                  data.aiProbability >= COMBINED_PROB_BLOCK_THRESHOLD);
            
            // Determine if the review is AI-written for DISPLAY purposes (uses its own threshold)
            const isReviewAIWritten = data.aiProbability >= AI_DISPLAY_THRESHOLD;

            // Mark review container as processed by the ML model
            reviewContainer.classList.add('review-processed-by-ml');

            let statusIndicator = reviewContainer.querySelector('.review-filter-status');
            if (!statusIndicator) {
                statusIndicator = document.createElement('div');
                statusIndicator.classList.add('review-filter-status');
                statusIndicator.style.cssText = `
                    font-size: 0.8em; font-weight: bold; margin-top: 5px;
                    padding: 3px 0; text-align: right;
                `;
                
                const starRatingElement = reviewContainer.querySelector('[data-hook="review-star-rating"]');
                const reviewHeaderElement = reviewContainer.querySelector('.a-section.review-header');

                if (starRatingElement) {
                    starRatingElement.after(statusIndicator);
                } else if (reviewHeaderElement) {
                    reviewHeaderElement.after(statusIndicator);
                } else {
                    reviewContainer.appendChild(statusIndicator); 
                }
            }

            // Update status indicator text to show both Fake/Real and AI/Human
            let statusText = `Status: ${isReviewFake ? 'FAKE' : 'REAL'} (Prob: ${(data.fakeProbability * 100).toFixed(2)}%)`;
            statusText += `<br>AI Status: ${isReviewAIWritten ? 'AI-WRITTEN' : 'HUMAN-WRITTEN'} (Prob: ${(data.aiProbability * 100).toFixed(2)}%)`;
            
            statusIndicator.innerHTML = statusText; // Use innerHTML to allow <br> tag
            
            // Set color based on overall classification
            if (isReviewFake) {
                statusIndicator.style.color = 'red'; // Red for any review classified as FAKE
            } else if (isReviewAIWritten) {
                statusIndicator.style.color = 'orange'; // Orange if just AI-written (but not FAKE by blocking rules)
            } else {
                statusIndicator.style.color = 'green'; // Green for REAL and HUMAN-WRITTEN
            }
            

            // Now, apply visibility/hiding based on 'isReviewFake' AND filter state
            let blockedMessageDiv = reviewContainer.querySelector('.fake-review-blocked-message');

            if (isReviewFake) { // This part blocks based on the new combined 'isReviewFake'
                reviewContainer.classList.add('fake-review-detected'); // Mark it as detected fake
                if (filterEnabled) {
                    config.elementsToHideSelectors.forEach(selector => {
                        reviewContainer.querySelectorAll(selector).forEach(el => el.style.display = 'none');
                    });
                    if (blockedMessageDiv) blockedMessageDiv.style.display = '';
                    blockedReviewCount++; // Increment if actually hiding
                } else {
                    // Not hiding, but mark as detected
                    config.elementsToHideSelectors.forEach(selector => {
                        reviewContainer.querySelectorAll(selector).forEach(el => el.style.display = '');
                    });
                    if (blockedMessageDiv) blockedMessageDiv.style.display = 'none';
                }
            } else { // If not fake according to the combined threshold
                reviewContainer.classList.remove('fake-review-detected');
                config.elementsToHideSelectors.forEach(selector => {
                    reviewContainer.querySelectorAll(selector).forEach(el => el.style.display = '');
                });
                if (blockedMessageDiv) blockedMessageDiv.style.display = 'none';
            }

        } catch (error) {
            console.error("Error sending review to Flask or processing (first 50 chars):", reviewText.substring(0,50), "...", error);
            const errorIndicator = reviewContainer.querySelector('.review-filter-status');
            if (errorIndicator) {
                errorIndicator.textContent = `Error: ${error.message}`;
                errorIndicator.style.color = 'orange';
            }
            // Ensure visibility if there was an error processing or if not fake
            reviewContainer.classList.remove('fake-review-detected');
            config.elementsToHideSelectors.forEach(selector => {
                reviewContainer.querySelectorAll(selector).forEach(el => el.style.display = '');
            });
            let blockedMessageDiv = reviewContainer.querySelector('.fake-review-blocked-message');
            if (blockedMessageDiv) blockedMessageDiv.style.display = 'none';
        }
    }
    // After processing all reviews, send the count to the popup
    chrome.runtime.sendMessage({ action: "updateBlockedCount", count: blockedReviewCount });
}

// Initial call to get filter state from background script and then process reviews
chrome.runtime.sendMessage({ action: "getFilterState" }, (response) => {
    console.log("Received initial filter state from background:", response.enabled);
    processAndFilterReviews(response.enabled);
});

// Also, listen for messages from popup (like "re-analyze") to trigger processing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reAnalyzeReviews") {
        console.log("Re-analyzing reviews due to popup message...");
        blockedReviewCount = 0; // Reset count on re-analyze

        // Clear existing status indicators and processed flags for a full refresh
        document.querySelectorAll('.review-filter-status').forEach(el => el.remove());
        document.querySelectorAll('.review-processed-by-ml').forEach(el => el.classList.remove('review-processed-by-ml'));
        document.querySelectorAll('.fake-review-detected').forEach(el => el.classList.remove('fake-review-detected')); 
        document.querySelectorAll('.fake-review-blocked-message').forEach(el => el.style.display = 'none'); // Hide messages

        // Re-run the analysis
        chrome.runtime.sendMessage({ action: "getFilterState" }, (response) => {
            processAndFilterReviews(response.enabled);
            sendResponse({ success: true }); // Acknowledge message for popup.js
        });
        return true; // Indicates asynchronous response
    }
});