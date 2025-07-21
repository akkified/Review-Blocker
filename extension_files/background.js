// background.js
console.log("Amazon Review Filter background script running.");

// Listener for messages from popup.js or content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getFilterState") {
        chrome.storage.local.get(['filterEnabled'], function(result) {
            sendResponse({ enabled: result.filterEnabled || false });
        });
        return true; // Indicates an asynchronous response
    } else if (request.action === "updateFilterState") {
        chrome.storage.local.set({ filterEnabled: request.enabled }, function() {
            console.log("Filter state updated to:", request.enabled);
            // Query for the active tab to re-execute content.js
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                // IMPORTANT: Check if tabs[0] exists and has a URL before proceeding
                if (tabs[0] && tabs[0].url && tabs[0].url.includes('amazon.com')) {
                    console.log("Executing content.js on active Amazon tab after filter state update.");
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    });
                } else {
                    console.log("No active Amazon tab found to execute content.js for filter state update.");
                }
            });
        });
    }
});

// Listen for tab updates (e.g., page navigation on Amazon) to apply filtering
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // IMPORTANT: Ensure tab, tab.url, and status are valid
    if (changeInfo.status === 'complete' && tab && tab.url && tab.url.includes('amazon.com')) {
        console.log(`Tab ${tabId} updated to complete: ${tab.url}. Executing content.js.`);
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
    }
});

// Initial execution on tab activation for existing Amazon pages
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        // IMPORTANT: Ensure tab and tab.url are valid
        if (tab && tab.url && tab.url.includes('amazon.com')) {
             console.log(`Tab ${tab.id} activated: ${tab.url}. Executing content.js.`);
             chrome.scripting.executeScript({
                target: { tabId: activeInfo.tabId },
                files: ['content.js']
            });
        } else {
            console.log("Activated tab is not an Amazon page or URL is not yet available.");
        }
    });
});