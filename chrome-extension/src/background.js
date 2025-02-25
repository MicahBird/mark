import { Ollama } from "ollama/browser";

// Initialize Ollama client
let ollamaClient = null;

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "saveWithTags",
    title: "Save with Tags",
    contexts: ["action"],
  });

  // Initialize Ollama client on install
  await initOllamaClient();
});

async function initOllamaClient() {
  try {
    const { ollamaEndpoint, ollamaModel } = await chrome.storage.sync.get([
      "ollamaEndpoint",
      "ollamaModel",
    ]);

    // Default to local Ollama instance and a general model if not configured
    const endpoint = ollamaEndpoint || "http://localhost:11434";
    const model = ollamaModel || "gemma:7b";

    ollamaClient = new Ollama({
      host: endpoint,
    });

    console.log("Ollama client initialized");
  } catch (error) {
    console.error("Error initializing Ollama client:", error);
  }
}

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

async function generateTagsWithOllama(title, description) {
  if (!ollamaClient) {
    await initOllamaClient();

    if (!ollamaClient) {
      console.error("Failed to initialize Ollama client");
      return [];
    }
  }

  try {
    const { ollamaModel, ollamaPrompt } = await chrome.storage.sync.get([
      "ollamaModel",
      "ollamaPrompt",
    ]);
    const model = ollamaModel || "gemma:7b";

    // Use custom prompt if available, otherwise use default
    let promptTemplate =
      ollamaPrompt ||
      `Generate 3-5 relevant tags for this content.
      Return only the tags as a JSON array of strings.
      No additional explanation needed.

      Title: {{title}}
      Description: {{description}}`;

    // Replace placeholders with actual content
    const prompt = promptTemplate
      .replace(/{{title}}/g, title)
      .replace(/{{description}}/g, description);

    const response = await ollamaClient.generate({
      model: model,
      prompt: prompt,
      options: {
        temperature: 0.3,
      },
    });

    // Try to parse the response as JSON
    try {
      // The response might include markdown backticks or other text
      // Try to extract just the JSON array
      const jsonMatch = response.response.match(/\[.*\]/);
      if (jsonMatch) {
        const tags = JSON.parse(jsonMatch[0]);
        return tags;
      }
      // If the entire response is valid JSON, use it
      return JSON.parse(response.response);
    } catch (parseError) {
      // If parsing fails, try to extract tags using regex
      console.warn(
        "Couldn't parse Ollama response as JSON, extracting tags manually",
        parseError,
      );
      const tagsPattern = /"([^"]+)"|'([^']+)'|`([^`]+)`|([a-zA-Z0-9-_]+)/g;
      const extractedTags = [];
      let match;

      while ((match = tagsPattern.exec(response.response)) !== null) {
        // Take the first capturing group that matched
        const tag = match[1] || match[2] || match[3] || match[4];
        if (tag) extractedTags.push(tag);
      }

      return extractedTags;
    }
  } catch (error) {
    console.error("Error generating tags with Ollama:", error);
    return [];
  }
}

async function quickSave(tab) {
  try {
    // Check for token
    const { apiToken, enableAutoTagging } = await chrome.storage.sync.get([
      "apiToken",
      "enableAutoTagging",
    ]);
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

        // Generate tags using Ollama only if auto-tagging is enabled
        let autoTags = [];
        if (enableAutoTagging !== false) {
          // Default to enabled if not set
          autoTags = await generateTagsWithOllama(
            response.title,
            response.description,
          );
        }

        // Prepare bookmark data
        const bookmark = {
          Url: response.url,
          Title: response.title,
          Description: response.description,
          Tags: autoTags || [], // Use generated tags
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
