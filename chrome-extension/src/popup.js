import { Ollama } from "ollama/browser";

function createTagElement(tag) {
  const tagElement = document.createElement("span");
  tagElement.className = "tag";

  const tagText = document.createTextNode(tag);
  const removeButton = document.createElement("button");
  removeButton.innerHTML = "&times;";
  removeButton.addEventListener("click", () => removeTag(tag, tagElement));

  tagElement.appendChild(tagText);
  tagElement.appendChild(removeButton);

  return tagElement;
}

function addTag(tag) {
  if (tags.has(tag)) return;

  tags.add(tag);
  const tagElement = createTagElement(tag);
  const container = document.getElementById("tagsContainer");
  container.insertBefore(tagElement, document.getElementById("tagInput"));
}

function removeTag(tag, element) {
  tags.delete(tag);
  element.remove();
}

function updateStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
}

async function generateTagsWithOllama(title, description) {
  try {
    // Show loading indicator
    document.getElementById("tagsLoading").style.display = "flex";

    // Get Ollama settings
    const { ollamaEndpoint, ollamaModel, ollamaPrompt } =
      await chrome.storage.sync.get([
        "ollamaEndpoint",
        "ollamaModel",
        "ollamaPrompt",
      ]);

    const endpoint = ollamaEndpoint || "http://localhost:11434";
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

    // Initialize Ollama client
    const ollamaClient = new Ollama({
      host: endpoint,
    });

    const response = await ollamaClient.generate({
      model: model,
      prompt: prompt,
      options: {
        temperature: 0.3,
      },
    });

    // Hide loading indicator
    document.getElementById("tagsLoading").style.display = "none";

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
    // Hide loading indicator
    document.getElementById("tagsLoading").style.display = "none";

    console.error("Error generating tags with Ollama:", error);
    updateStatus(`Error generating tags: ${error.message}`);
    return [];
  }
}

let pageInfo = null;
let tags = new Set();

async function initializeDetailedSave() {
  try {
    // Get the stored page info
    const data = await chrome.storage.local.get("tempPageInfo");
    if (data.tempPageInfo) {
      pageInfo = data.tempPageInfo;
      document.getElementById("title").value = pageInfo.title;
      document.getElementById("description").value = pageInfo.description;

      // Clean up the stored data
      chrome.storage.local.remove("tempPageInfo");
    } else {
      updateStatus("Error: No page data available");
    }
  } catch (error) {
    updateStatus("Error: Could not load page data");
    console.error(error);
  }

  // Handle tag input
  const tagInput = document.getElementById("tagInput");
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      e.preventDefault();
      addTag(e.target.value.trim());
      e.target.value = "";
    }
  });

  // Handle manual tag generation
  document
    .getElementById("generateTags")
    .addEventListener("click", async () => {
      if (!pageInfo) {
        updateStatus("Error: Page information not available");
        return;
      }

      const generatedTags = await generateTagsWithOllama(
        pageInfo.title,
        document.getElementById("description").value,
      );

      if (generatedTags && generatedTags.length > 0) {
        // Add each generated tag
        generatedTags.forEach((tag) => addTag(tag));
        updateStatus(`Generated ${generatedTags.length} tags`);
      } else {
        updateStatus("No tags could be generated");
      }
    });

  // Handle save
  document
    .getElementById("saveBookmark")
    .addEventListener("click", async () => {
      try {
        const { apiToken } = await chrome.storage.sync.get(["apiToken"]);
        if (!apiToken) {
          updateStatus("Please set your API token in extension options");
          return;
        }

        if (!pageInfo) {
          updateStatus("Error: Page information not available");
          return;
        }

        const bookmark = {
          Url: pageInfo.url,
          Title: pageInfo.title,
          Description: document.getElementById("description").value,
          Tags: Array.from(tags),
        };

        const response = await fetch("http://localhost:1990/api/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify(bookmark),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        updateStatus("Saved successfully!");
        setTimeout(() => window.close(), 1000);
      } catch (error) {
        updateStatus(`Error: ${error.message}`);
      }
    });
}

document.addEventListener("DOMContentLoaded", initializeDetailedSave);
