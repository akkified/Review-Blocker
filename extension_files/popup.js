// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const filterToggle = document.getElementById('filterToggle');
    const reanalyzeButton = document.getElementById('reanalyzeButton');
    const statusMessage = document.getElementById('statusMessage');
    const blockedCountDisplay = document.getElementById('blockedCountDisplay'); // New element

    // Function to update the blocked count display
    function updateBlockedCount(count) {
        if (count > 0) {
            blockedCountDisplay.textContent = `Blocked ${count} potentially fake reviews.`;
        } else {
            blockedCountDisplay.textContent = ""; // Clear if no reviews blocked
        }
    }

    // Load saved state when popup opens
    chrome.runtime.sendMessage({ action: "getFilterState" }, (response) => {
        filterToggle.checked = response.enabled;
        if (response.enabled) {
            statusMessage.textContent = "Fake reviews are currently hidden.";
        } else {
            statusMessage.textContent = "Fake reviews are currently visible.";
        }
        // Immediately request current count when popup opens
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('amazon.com')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "requestBlockedCount" }, (responseFromContent) => {
                    if (responseFromContent && responseFromContent.count !== undefined) {
                        updateBlockedCount(responseFromContent.count);
                    }
                });
            } else {
                updateBlockedCount(0); // Clear count if not on Amazon
            }
        });
    });

    // Save state when toggle changes
    filterToggle.addEventListener('change', () => {
        const isEnabled = filterToggle.checked;
        chrome.runtime.sendMessage({ action: "updateFilterState", enabled: isEnabled });
        if (isEnabled) {
            statusMessage.textContent = "Fake reviews are now hidden.";
        } else {
            statusMessage.textContent = "Fake reviews are now visible.";
        }
        // Trigger re-analysis to apply/unapply filters and update count
        reanalyzeButton.click(); 
    });

    // Re-analyze button listener
    reanalyzeButton.addEventListener('click', () => {
        statusMessage.textContent = "Re-analyzing page...";
        updateBlockedCount(0); // Clear count immediately on re-analyze click
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('amazon.com')) {
                // Send message to content script to re-process reviews
                chrome.tabs.sendMessage(tabs[0].id, { action: "reAnalyzeReviews" }, (responseFromContent) => {
                    if (chrome.runtime.lastError) {
                        statusMessage.textContent = "Error: Could not re-analyze. Check console for details.";
                        console.error("Error sending re-analyze message:", chrome.runtime.lastError);
                    } else if (responseFromContent && responseFromContent.success) {
                         statusMessage.textContent = "Page re-analyzed.";
                    } else {
                        statusMessage.textContent = "Re-analysis initiated (no direct success response from content script).";
                    }
                });
            } else {
                statusMessage.textContent = "Error: Not on an Amazon page. Cannot re-analyze.";
            }
        });
    });

    // Listener for messages from content.js (to receive blocked count)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateBlockedCount") {
            updateBlockedCount(request.count);
        }
        // Handle requestBlockedCount from popup opening
        if (request.action === "requestBlockedCount") {
            // This case is handled in content.js directly by sending updateBlockedCount
            // We keep this listener to capture messages sent from content.js
            sendResponse({ count: window.blockedReviewCount || 0 }); // Fallback
        }
    });
});