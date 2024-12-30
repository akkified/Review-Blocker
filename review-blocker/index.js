document.addEventListener("DOMContentLoaded", () => {
    const checkbox = document.getElementById("myCheckbox");
    const statusLabel = document.getElementById("statusLabel");

    // Query the active tab and check if the site is supported
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            // No active tab found (e.g., blank tab or chrome:// page)
            statusLabel.textContent = "Error: No active tab.";
            checkbox.disabled = true; // Disable the toggle switch
            return;
        }

        const activeTab = tabs[0];
        const tabUrl = activeTab.url;
        const allowedDomains = ["https://www.amazon.com/", "https://www.walmart.com/","https://www.ebay.com/","https://www.target.com/","https://www.costco.com/","https://www.aliexpress.com/","https://www.wish.com/","https://www.bestbuy.com/"];
        const isSupported = allowedDomains.some((domain) => tabUrl.includes(domain));

        if (isSupported) {
            // Enable the toggle switch and load the saved state
            chrome.storage.sync.get("isEnabled", (data) => {
                const isEnabled = data.isEnabled || false;
                checkbox.checked = isEnabled;
                statusLabel.textContent = isEnabled ? "Enabled" : "Disabled";
                checkbox.disabled = false; // Enable the toggle switch
            });
        } else {
            // Disable the toggle switch and display a "Site not supported" message
            checkbox.disabled = true;
            statusLabel.textContent = "Site not supported.";
        }
    });

    // Save the state and send a message when the checkbox is toggled
    checkbox.addEventListener("change", () => {
        const isEnabled = checkbox.checked;
        statusLabel.textContent = "Processing...";

        // Save the new state to storage
        chrome.storage.sync.set({ isEnabled });

        // Send a message to the background script
        chrome.runtime.sendMessage(
            { type: "toggleCheckbox", isEnabled },
            (response) => {
                if (chrome.runtime.lastError) {
                    statusLabel.textContent = "Error: Cannot communicate with background.";
                } else if (response.status === "error") {
                    if (response.error === "No active tab available") {
                        statusLabel.textContent = "Error: No active tab.";
                    } else if (response.error === "Site not supported") {
                        statusLabel.textContent = "Site not supported.";
                    } else {
                        statusLabel.textContent = "Error: " + response.error;
                    }
                } else {
                    statusLabel.textContent = isEnabled ? "Enabled" : "Disabled";
                }
            }
        );
    });
});
