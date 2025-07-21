// content.js - This script runs in the context of the webpage

// Wrap everything in an IIFE to create a private scope
(function() {

    let blockedReviewCount = 0; // Initialize a variable to keep track of blocked reviews within this scope

    // Function to send review text to your Flask backend
    async function sendReviewToBackend(reviewText) {
        // !! IMPORTANT: Replace this with YOUR ACTUAL PythonAnywhere URL !!
        const backendUrl = 'https://shreyasb.pythonanywhere.com/analyze_review';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reviewText: reviewText })
            });

            // Check if the request was successful
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            return data; // This should contain { fakeProbability: X, aiProbability: Y }
        } catch (error) {
            console.error("Error sending review to backend:", error);
            return null;
        }
    }

    // Function to find the review elements on the page and extract text
    // This function will now return an array of review texts
    function extractReviewTexts() {
        const reviewElements = document.querySelectorAll('[data-hook="review"]'); // Targets all elements with data-hook="review"
        const reviewTexts = [];

        reviewElements.forEach(reviewEl => {
            // Within each review container, find the actual text body.
            // You'll need to inspect inside one 'review' element to find the specific data-hook or class for the TEXT.
            // A common one is 'review-body'
            const reviewBodyElement = reviewEl.querySelector('[data-hook="review-body"]'); // <--- YOU MAY NEED TO ADJUST THIS INNER SELECTOR
            
            if (reviewBodyElement) {
                const text = reviewBodyElement.innerText.trim();
                if (text.length > 10) { // Basic check for sufficient text
                    reviewTexts.push(text);
                }
            }
        });
        return reviewTexts;
    }

    // Function to update the UI with the probabilities (now for a specific review)
    function updateUIForReview(reviewElement, probabilities) {
        if (probabilities && typeof probabilities.fakeProbability === 'number' && typeof probabilities.aiProbability === 'number') { // Corrected typeof check
            const fakeProb = (probabilities.fakeProbability * 100).toFixed(2);
            const aiProb = (probabilities.aiProbability * 100).toFixed(2);

            // Determine if the review is considered fake based on the new logic
            const isConsideredFake = 
                (probabilities.fakeProbability > 0.75 || probabilities.aiProbability > 0.75) ||
                (probabilities.fakeProbability > 0.50 && probabilities.aiProbability > 0.50);

            // Create or find a display element specific to THIS review
            let resultDisplayElement = reviewElement.querySelector('.review-analysis-results');
            if (!resultDisplayElement) {
                resultDisplayElement = document.createElement('div');
                resultDisplayElement.className = 'review-analysis-results';
                resultDisplayElement.style.marginTop = '5px';
                resultDisplayElement.style.padding = '8px';
                resultDisplayElement.style.border = '1px solid #eee';
                resultDisplayElement.style.backgroundColor = '#f0f8ff'; // Light blue for visibility
                resultDisplayElement.style.borderRadius = '3px';
                resultDisplayElement.style.fontSize = '0.85em';
                reviewElement.appendChild(resultDisplayElement); // Append inside the current review element
            }

            const indicatorColor = isConsideredFake ? 'red' : 'green';
            const indicatorText = isConsideredFake ? 'Likely Fake / AI-Generated!' : 'Appears Genuine.';

            resultDisplayElement.innerHTML = `
                <p style="margin: 0;"><strong>Analysis:</strong></p>
                <p style="margin: 0;">Fake Prob: ${fakeProb}% | AI Prob: ${aiProb}%</p>
                <p style="margin: 0; font-weight: bold; color: ${indicatorColor};">${indicatorText}</p>
            `;
            console.log("UI updated for a review with probabilities:", probabilities);

        } else {
            console.error("Invalid probabilities received for a review:", probabilities);
        }
    }

    // Main execution logic
    async function runReviewAnalysis() {
        console.log("Amazon Review Filter content script loaded. Starting analysis...");
        blockedReviewCount = 0; // Reset count at the start of analysis

        const reviewContainers = document.querySelectorAll('[data-hook="review"]');

        if (reviewContainers.length > 0) {
            console.log(`Found ${reviewContainers.length} review containers. Processing each.`);
            
            for (const reviewEl of reviewContainers) {
                const reviewBodyElement = reviewEl.querySelector('[data-hook="review-body"]');
                if (!reviewBodyElement) {
                    console.warn("Could not find review body within a review container. Skipping.");
                    continue;
                }

                const reviewText = reviewBodyElement.innerText.trim();
                
                if (reviewText && reviewText.length > 10) { // Basic check for sufficient text
                    console.log("Sending review text to backend:", reviewText.substring(0, 100) + "..."); // Log first 100 chars
                    const probabilities = await sendReviewToBackend(reviewText);
                    if (probabilities) {
                        // Update UI for the review
                        updateUIForReview(reviewEl, probabilities);

                        // NEW LOGIC FOR INCREMENTING BLOCKED COUNT
                        const isConsideredFake = 
                            (probabilities.fakeProbability > 0.75 || probabilities.aiProbability > 0.75) ||
                            (probabilities.fakeProbability > 0.50 && probabilities.aiProbability > 0.50);

                        if (isConsideredFake) {
                            blockedReviewCount++;
                        }
                    } else {
                        console.warn("Could not get probabilities from backend for a review.");
                    }
                } else {
                    console.log("Review text too short or empty. Skipping analysis for this review.");
                }
            }
            // After processing all reviews, send the final blocked count to the popup
            chrome.runtime.sendMessage({ action: "updateBlockedCount", count: blockedReviewCount });

        } else {
            console.log("No review containers found using '[data-hook=\"review\"]'.");
            // Also send 0 if no reviews found
            chrome.runtime.sendMessage({ action: "updateBlockedCount", count: 0 });
        }
    }

    // Decide when to run the analysis
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runReviewAnalysis, 500); 
    });

    // Listener for messages from popup.js or background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "reAnalyzeReviews") {
            console.log("Message received: reAnalyzeReviews. Re-running analysis.");
            runReviewAnalysis(); // Re-run the analysis
            sendResponse({ success: true, count: blockedReviewCount }); // Send success and current count
            return true; // Indicates asynchronous response
        } else if (message.action === "requestBlockedCount") {
            console.log("Message received: requestBlockedCount. Responding with current count.");
            sendResponse({ count: blockedReviewCount }); // Respond with the current count
            return true; // Indicates asynchronous response
        }
    });

})(); // End of IIFE