chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveWithTags",
    title: "Save with Tags",
    contexts: ["action"],
  });
});

chrome.action.onClicked.addListener((tab) => {
  quickSave(tab);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveWithTags") {
    // First get the page info
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getPageInfo",
      });
      // Store the data temporarily
      await chrome.storage.local.set({ tempPageInfo: response });

      // Open the popup with the tab id
      chrome.windows.create({
        url: "popup.html",
        type: "popup",
        width: 400,
        height: 500,
      });
    } catch (error) {
      console.error("Error getting page info:", error);
    }
  }
});

async function quickSave(tab) {
  try {
    // Check for token
    const { apiToken } = await chrome.storage.sync.get(["apiToken"]);
    if (!apiToken) {
      chrome.runtime.openOptionsPage();
      return;
    }

    // Get page info from content script
    chrome.tabs.sendMessage(
      tab.id,
      { action: "getPageInfo" },
      async function (response) {
        if (chrome.runtime.lastError) {
          console.error("Could not connect to page");
          return;
        }

        // Prepare bookmark data
        const bookmark = {
          Url: response.url,
          Title: response.title,
          Description: response.description,
          Tags: [],
        };

        try {
          // Send to API
          const apiResponse = await fetch(
            "http://localhost:1990/api/bookmarks",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiToken}`,
              },
              body: JSON.stringify(bookmark),
            },
          );

          if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
          }

          // Show success badge
          chrome.action.setBadgeText({ text: "✓" });
          chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
          setTimeout(() => {
            chrome.action.setBadgeText({ text: "" });
          }, 2000);
        } catch (error) {
          console.error("Error:", error);
          // Show error badge
          chrome.action.setBadgeText({ text: "!" });
          chrome.action.setBadgeBackgroundColor({ color: "#F44336" });
          setTimeout(() => {
            chrome.action.setBadgeText({ text: "" });
          }, 2000);
        }
      },
    );
  } catch (error) {
    console.error("Error:", error);
  }
}
