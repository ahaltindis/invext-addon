const INVENTREE_URL = "http://192.168.1.XX:8080";
const API_TOKEN = "your_token_here";
console.log("##InvExt loaded##");

// 1. Create the Sidebar UI
const sidebar = document.createElement("div");
sidebar.id = "inventree-sidebar";
sidebar.innerHTML = '<h3>InvenTree Queue test</h3><div id="item-list"></div>';
document.body.appendChild(sidebar);

// 2. The Scraper Function
function scrapeOrders() {
  console.log("scrapeOrders called..");
  const itemList = document.getElementById("item-list");
  // Target the individual order items
  const products = document.querySelectorAll(".order-item");

  products.forEach((el) => {
    // 1. Extract Product ID from the item link
    const linkEl = el.querySelector(".order-item-content-info-name a");
    const href = linkEl?.href || "";
    const productId = href.match(/item\/(\d+)\.html/)?.[1];

    // Prevent duplicates in the sidebar
    if (!productId || document.getElementById(`card-${productId}`)) return;

    // 2. Extract Title (using the 'title' attribute for full text)
    const titleSpan = el.querySelector(".order-item-content-info-name span");
    const fullTitle =
      titleSpan?.getAttribute("title") ||
      titleSpan?.innerText ||
      "Unknown Part";

    // 3. Extract SKU/Variation (e.g., "256MB")
    const sku =
      el.querySelector(".order-item-content-info-sku")?.innerText || "";

    // 4. Extract Image URL from background-image style
    const imgDiv = el.querySelector(".order-item-content-img");
    const style = imgDiv?.getAttribute("style") || "";
    const imgMatch = style.match(/url\("?(.+?)"?\)/);
    const imgUrl = imgMatch ? imgMatch[1] : "";

    // 5. Extract Quantity
    const qtyText =
      el.querySelector(".order-item-content-info-number-quantity")?.innerText ||
      "x1";
    const qty = qtyText.replace("x", "");

    // 6. Create the Card UI
    const card = document.createElement("div");
    card.className = "order-card";
    card.id = `card-${productId}`;
    card.innerHTML = `
      <div style="display:flex; gap:10px;">
        <img src="${imgUrl}" style="width:50px; height:50px; border-radius:4px;">
        <div style="flex:1">
          <input type="text" value="${fullTitle.substring(0, 50)}" id="name-${productId}" title="${fullTitle}">
          <div style="font-size:11px; color:#666;">SKU: ${sku} | Qty: ${qty}</div>
          <button class="btn-send" data-id="${productId}" style="margin-top:5px;">Add to InvenTree</button>
        </div>
      </div>
    `;

    itemList.appendChild(card);

    // Click Event for the button
    card.querySelector(".btn-send").addEventListener("click", () => {
      // We pass the SKU and Qty into the send function now too
      sendToInvenTree(productId, fullTitle, imgUrl, qty, sku);
    });
  });
}

// 3. API Communication
async function sendToInvenTree(id, fullTitle, imgUrl) {
  const cleanName = document.getElementById(`name-${id}`).value;

  try {
    const response = await fetch(`${INVENTREE_URL}/api/part/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: cleanName,
        description: fullTitle,
        category: 1, // Change this to your electronics category ID
        active: true,
        is_template: false,
        purchaseable: true,
      }),
    });

    if (response.ok) {
      document.getElementById(`card-${id}`).style.backgroundColor = "#d4edda";
      document.getElementById(`card-${id}`).querySelector("button").innerText =
        "Added!";
    }
  } catch (err) {
    console.error("InvenTree Error:", err);
  }
}

// 4. Watch for page changes (AliExpress is dynamic)
const observer = new MutationObserver(scrapeOrders);
observer.observe(document.body, { childList: true, subtree: true });
scrapeOrders();
