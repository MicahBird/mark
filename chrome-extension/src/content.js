chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageInfo") {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      description: getDescription(),
    };
    sendResponse(pageInfo);
  }
});

function getDescription() {
  // Try meta description first
  const metaDesc =
    document.querySelector('meta[property="og:description"]')?.content ||
    document.querySelector('meta[name="description"]')?.content;
  if (metaDesc) return metaDesc;

  // Fallback to first paragraph
  const firstPara = document.querySelector("p")?.textContent;
  return firstPara ? firstPara.substring(0, 200) + "..." : "";
}
