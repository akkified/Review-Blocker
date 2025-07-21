// content.js - This script runs in the context of the webpage

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
            // Attempt to parse error message from backend if available
            const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        return data; // This should contain { fakeProbability: X, aiProbability: Y }
    } catch (error) {
        console.error("Error sending review to backend:", error);
        // Depending on your UI, you might want to display an error message to the user
        return null; // Return null or throw error to indicate failure
    }
}

// Function to find the review element on the page and extract text
function extractReviewText() {
    // This is a placeholder. You need to adjust this selector
    // to target the specific HTML element containing the review text on the website
    // you are trying to analyze (e.g., Amazon, Yelp, etc.).
    // Use your browser's developer tools (Inspect Element) to find the correct CSS selector.
    const reviewElement = document.querySelector('YOUR_REVIEW_CSS_SELECTOR_HERE'); // <<< CHANGE THIS
    if (reviewElement) {
        return reviewElement.innerText.trim();
    }
    return null;
}

// Function to update the UI with the probabilities
function updateUIWithProbabilities(probabilities) {
    if (probabilities && typeof probabilities.fakeProbability === 'number' && typeof probabilities.aiProbability === 'number') {
        const fakeProb = (probabilities.fakeProbability * 100).toFixed(2);
        const aiProb = (probabilities.aiProbability * 100).toFixed(2);

        // This is a placeholder for where you want to display the results.
        // You'll likely need to create or modify an existing element on the page.
        let resultDisplayElement = document.querySelector('#review-blocker-results'); // Try to find existing
        if (!resultDisplayElement) {
            // If not found, create a new element (e.g., a div)
            resultDisplayElement = document.createElement('div');
            resultDisplayElement.id = 'review-blocker-results';
            resultDisplayElement.style.marginTop = '10px';
            resultDisplayElement.style.padding = '10px';
            resultDisplayElement.style.border = '1px solid #ccc';
            resultDisplayElement.style.backgroundColor = '#f9f9f9';
            resultDisplayElement.style.borderRadius = '5px';
            // Append it to a suitable parent element on the page
            // For example, after the review element, or at the top of the body
            const body = document.body; // Or document.querySelector('YOUR_TARGET_PARENT_ELEMENT')
            if (body) {
                body.prepend(resultDisplayElement); // Or append, or insert after reviewElement
            }
        }

        resultDisplayElement.innerHTML = `
            <h3>Review Analysis:</h3>
            <p>Fake Probability: <strong>${fakeProb}%</strong></p>
            <p>AI Probability: <strong>${aiProb}%</strong></p>
            <p style="font-size: 0.9em; color: ${probabilities.fakeProbability > 0.5 ? 'red' : 'green'};">
                ${probabilities.fakeProbability > 0.5 ? 'This review might be fake!' : 'This review seems genuine.'}
            </p>
        `;
        console.log("UI updated with probabilities:", probabilities);

    } else {
        console.error("Invalid probabilities received:", probabilities);
        // Optionally display an error in the UI
    }
}

// Main execution logic
async function runReviewAnalysis() {
    const reviewText = extractReviewText();

    if (reviewText && reviewText.length > 10) { // Basic check for sufficient text
        console.log("Sending review text to backend:", reviewText);
        const probabilities = await sendReviewToBackend(reviewText);
        if (probabilities) {
            updateUIWithProbabilities(probabilities);
        } else {
            console.warn("Could not get probabilities from backend.");
            // Optionally update UI to show an error or a "failed" state
        }
    } else {
        console.log("No review text found or too short to analyze.");
        // Optionally clear previous results or show a message
    }
}

// Decide when to run the analysis
// You might want to run it:
// 1. Immediately on page load (simple, but might miss dynamic content)
// 2. After a short delay (to let dynamic content load)
// 3. When a specific DOM element appears (more robust for SPAs)
// 4. On a user action (e.g., clicking a button)

// Option 1: Run on DOMContentLoaded (basic)
document.addEventListener('DOMContentLoaded', runReviewAnalysis);

// Option 2: Run after a delay (can help with some dynamic content)
// window.addEventListener('load', () => setTimeout(runReviewAnalysis, 1500));

// Option 3: Use a MutationObserver for more complex dynamic pages
// (e.g., for single-page applications where reviews load after initial page load)
// const observer = new MutationObserver((mutations, obs) => {
//     // Check if the review element is now present
//     if (document.querySelector('YOUR_REVIEW_CSS_SELECTOR_HERE')) { // <<< CHANGE THIS
//         runReviewAnalysis();
//         obs.disconnect(); // Stop observing once the review is found and processed
//     }
// });
// observer.observe(document.body, { childList: true, subtree: true });

// You could also add a message listener if your popup.js or background.js triggers the analysis
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === "analyzeCurrentPage") {
//         runReviewAnalysis();
//         sendResponse({ status: "Analysis initiated" });
//     }
// });