const STORAGE_KEY = "invScrapedItems";

function scrapeOrders() {
  const products = document.querySelectorAll(".order-item");

  products.forEach((el) => {
    const linkEl = el.querySelector(".order-item-content-info-name a");
    const href = linkEl?.href || "";
    const productId = href.match(/item\/(\d+)\.html/)?.[1];

    if (!productId) return;

    const titleSpan = el.querySelector(".order-item-content-info-name span");
    const fullTitle = titleSpan?.getAttribute("title") || titleSpan?.innerText || "Unknown Part";

    const sku = el.querySelector(".order-item-content-info-sku")?.innerText || "";

    const imgDiv = el.querySelector(".order-item-content-img");
    const style = imgDiv?.getAttribute("style") || "";
    const imgMatch = style.match(/url\("?(.+?)"?\)/);
    const imgUrl = imgMatch ? imgMatch[1] : "";

    const qtyText = el.querySelector(".order-item-content-info-number-quantity")?.innerText || "x1";
    const qty = qtyText.replace("x", "");

    const item = {
      id: productId,
      title: fullTitle,
      sku: sku,
      imgUrl: imgUrl,
      qty: qty,
      addedToInvenTree: false,
    };

    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const items = result[STORAGE_KEY] || [];
      if (!items.find(i => i.id === productId)) {
        console.log(`invext item added ${item.title}`)
        items.push(item);
        chrome.storage.local.set({ [STORAGE_KEY]: items });
      }
    });
  });
}

const observer = new MutationObserver(scrapeOrders);
observer.observe(document.body, { childList: true, subtree: true });
scrapeOrders();

console.log("##InvExt: Scraper loaded##");
