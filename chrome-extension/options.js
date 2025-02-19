document.addEventListener("DOMContentLoaded", function () {
  // Load saved token
  chrome.storage.sync.get(["apiToken"], function (result) {
    if (result.apiToken) {
      document.getElementById("tokenInput").value = result.apiToken;
    }
  });

  // Save token
  document.getElementById("saveToken").addEventListener("click", function () {
    const token = document.getElementById("tokenInput").value;
    chrome.storage.sync.set({ apiToken: token }, function () {
      updateStatus("Token saved successfully!");
    });
  });
});

function updateStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 3000);
}
