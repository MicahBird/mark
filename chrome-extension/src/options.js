import { Ollama } from "ollama/browser";

document.addEventListener("DOMContentLoaded", function () {
  // Load saved settings
  chrome.storage.sync.get(
    [
      "apiToken",
      "ollamaEndpoint",
      "ollamaModel",
      "ollamaPrompt",
      "enableAutoTagging",
    ],
    function (result) {
      if (result.apiToken) {
        document.getElementById("tokenInput").value = result.apiToken;
      }

      if (result.ollamaEndpoint) {
        document.getElementById("ollamaEndpoint").value = result.ollamaEndpoint;
      }

      if (result.ollamaModel) {
        document.getElementById("ollamaModel").value = result.ollamaModel;
      }

      if (result.ollamaPrompt) {
        document.getElementById("ollamaPrompt").value = result.ollamaPrompt;
      } else {
        // Set default prompt if not already set
        document.getElementById("ollamaPrompt").value =
          `Generate 3-5 relevant tags for this content. Return only the tags as a JSON array of strings. No additional explanation needed.

Title: {{title}}
Description: {{description}}`;
      }

      // Set auto-tagging checkbox
      document.getElementById("enableAutoTagging").checked =
        result.enableAutoTagging !== false; // Default to true
    },
  );

  // Save settings
  document
    .getElementById("saveSettings")
    .addEventListener("click", function () {
      const token = document.getElementById("tokenInput").value;
      const ollamaEndpoint =
        document.getElementById("ollamaEndpoint").value ||
        "http://localhost:11434";
      const ollamaModel =
        document.getElementById("ollamaModel").value || "gemma:7b";
      const ollamaPrompt =
        document.getElementById("ollamaPrompt").value ||
        `Generate 3-5 relevant tags for this content. Return only the tags as a JSON array of strings. No additional explanation needed.

Title: {{title}}
Description: {{description}}`;

      const enableAutoTagging =
        document.getElementById("enableAutoTagging").checked;

      chrome.storage.sync.set(
        {
          apiToken: token,
          ollamaEndpoint: ollamaEndpoint,
          ollamaModel: ollamaModel,
          ollamaPrompt: ollamaPrompt,
          enableAutoTagging: enableAutoTagging,
        },
        function () {
          updateStatus("Settings saved successfully!");
        },
      );
    });

  // Test Ollama connection
  document
    .getElementById("testOllama")
    .addEventListener("click", async function () {
      try {
        updateStatus("Testing Ollama connection...");

        const endpoint =
          document.getElementById("ollamaEndpoint").value ||
          "http://localhost:11434";
        const model =
          document.getElementById("ollamaModel").value || "gemma:7b";

        const ollama = new Ollama({
          host: endpoint,
        });

        // Try to get the list of models to verify connection
        const models = await ollama.list();

        // Check if the specified model is available
        const modelExists = models.models.some((m) => m.name === model);

        if (modelExists) {
          updateStatus(`Connection successful! Model "${model}" is available.`);
        } else {
          updateStatus(
            `Connection successful, but model "${model}" was not found. Available models: ${models.models.map((m) => m.name).join(", ")}`,
          );
        }
      } catch (error) {
        updateStatus(`Error connecting to Ollama: ${error.message}`);
        console.error(error);
      }
    });

  // Test prompt for tag generation
  document
    .getElementById("testPrompt")
    .addEventListener("click", async function () {
      try {
        updateStatus("Testing tag generation...");

        const endpoint =
          document.getElementById("ollamaEndpoint").value ||
          "http://localhost:11434";
        const model =
          document.getElementById("ollamaModel").value || "gemma:7b";
        const promptTemplate = document.getElementById("ollamaPrompt").value;

        // Sample data for testing
        const sampleTitle = "Understanding Machine Learning Algorithms";
        const sampleDescription =
          "An overview of common machine learning algorithms including supervised and unsupervised learning approaches, with examples of practical applications.";

        // Replace placeholders with sample data
        const prompt = promptTemplate
          .replace(/{{title}}/g, sampleTitle)
          .replace(/{{description}}/g, sampleDescription);

        const ollama = new Ollama({
          host: endpoint,
        });

        const response = await ollama.generate({
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
          let tags = [];

          if (jsonMatch) {
            tags = JSON.parse(jsonMatch[0]);
          } else {
            // If parsing fails, try to extract tags using regex
            const tagsPattern =
              /"([^"]+)"|'([^']+)'|`([^`]+)`|([a-zA-Z0-9-_]+)/g;
            let match;

            while ((match = tagsPattern.exec(response.response)) !== null) {
              // Take the first capturing group that matched
              const tag = match[1] || match[2] || match[3] || match[4];
              if (tag) tags.push(tag);
            }
          }

          // Display the results
          const resultsDiv = document.getElementById("promptTestResults");
          resultsDiv.style.display = "block";

          const tagsDiv = document.getElementById("generatedTags");
          if (tags.length > 0) {
            tagsDiv.innerHTML = tags
              .map(
                (tag) =>
                  `<span style="display: inline-block; background: #e0e0e0; padding: 4px 8px; border-radius: 4px; margin: 2px; font-size: 14px;">${tag}</span>`,
              )
              .join("");
            updateStatus("Tag generation successful!");
          } else {
            tagsDiv.innerHTML =
              "<p>No tags could be parsed from the response.</p>";
            tagsDiv.innerHTML +=
              "<p><strong>Raw response:</strong> " + response.response + "</p>";
            updateStatus("Warning: Could not parse tags from the response.");
          }
        } catch (parseError) {
          console.error("Error parsing tags:", parseError);
          updateStatus("Error parsing tags from Ollama response.");

          // Still show the raw response
          const resultsDiv = document.getElementById("promptTestResults");
          resultsDiv.style.display = "block";

          const tagsDiv = document.getElementById("generatedTags");
          tagsDiv.innerHTML = "<p>Error parsing response.</p>";
          tagsDiv.innerHTML +=
            "<p><strong>Raw response:</strong> " + response.response + "</p>";
        }
      } catch (error) {
        updateStatus(`Error testing prompt: ${error.message}`);
        console.error(error);
      }
    });
});

function updateStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
    }
  }, 5000);
}
