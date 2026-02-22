chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.invScrapedItems) {
    updateBadge();
  }
});

function updateBadge() {
  chrome.storage.local.get("invScrapedItems", (result) => {
    const items = result.invScrapedItems || [];
    const count = items.filter((i) => !i.addedToInvenTree).length;

    if (count > 0) {
      chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count) });
      chrome.action.setBadgeBackgroundColor({ color: "#28a745" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  });
}
