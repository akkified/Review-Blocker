const allowedDomains = ["https://www.amazon.com/", "https://www.walmart.com/","https://www.ebay.com/","https://www.target.com/","https://www.costco.com/","https://www.aliexpress.com/","https://www.wish.com/","https://www.bestbuy.com/"];

chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeText({
        text: "OFF",
    });
    console.log("Extension installed, badge set to OFF.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in background script:", message);

    if (message.type === "toggleCheckbox") {
        const isEnabled = message.isEnabled;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                sendResponse({ status: "error", error: "No active tab available" });
                return;
            }

            const activeTab = tabs[0];
            const tabUrl = activeTab.url;

            if (!tabUrl || tabUrl.startsWith("chrome://") || tabUrl.startsWith("edge://")) {
                sendResponse({
                    status: "error",
                    error: "Invalid or unsupported tab URL",
                    tabUrl,
                });
                return;
            }

            const isAllowed = allowedDomains.some((domain) => tabUrl.includes(domain));

            if (isAllowed) {
                chrome.action.setBadgeText({
                    tabId: activeTab.id,
                    text: isEnabled ? "ON" : "OFF",
                });

                if (isEnabled) {
                    chrome.scripting
                        .insertCSS({
                            files: ["focus-mode.css"],
                            target: { tabId: activeTab.id },
                        })
                        .then(() => sendResponse({ status: "CSS injected", isEnabled }))
                        .catch((error) => sendResponse({ status: "Error injecting CSS", error }));
                } else {
                    chrome.scripting
                        .removeCSS({
                            files: ["focus-mode.css"],
                            target: { tabId: activeTab.id },
                        })
                        .then(() => sendResponse({ status: "CSS removed", isEnabled }))
                        .catch((error) => sendResponse({ status: "Error removing CSS", error }));
                }
            } else {
                sendResponse({
                    status: "error",
                    error: "Site not supported",
                    tabUrl,
                });
            }
        });

        return true; // Ensure sendResponse is valid for asynchronous operations
    } else {
        sendResponse({ status: "error", error: "Unknown message type" });
    }
});
