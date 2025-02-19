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
