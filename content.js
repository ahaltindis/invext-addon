const STORAGE_KEYS = ["invUrl", "invToken", "invUser"];
console.log("##InvExt loaded##");

// Main UI Initializer
async function initSidebar() {
  const settings = await chrome.storage.local.get(STORAGE_KEYS);

  // Create Sidebar container if it doesn't exist
  let sidebar = document.getElementById("inventree-sidebar");
  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = "inventree-sidebar";
    document.body.appendChild(sidebar);
  }

  // State 1: We have a token, let's verify it
  if (settings.invUrl && settings.invToken) {
    sidebar.innerHTML = "<p>Verifying connection...</p>";
    const isValid = await verifyToken(settings.invUrl, settings.invToken);

    if (isValid) {
      renderActiveUI(settings.invUrl);
      return;
    }
  }

  // State 2: No token or invalid, show Login
  renderLoginUI(settings.invUrl, settings.invUser);
}

async function verifyToken(url, token) {
  try {
    const res = await fetch(`${url}/api/user/me/`, {
      headers: { Authorization: `Token ${token}` },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function renderLoginUI(savedUrl = "", savedUser = "") {
  const sidebar = document.getElementById("inventree-sidebar");
  sidebar.innerHTML = `
        <h2 style="margin-top:0">InvenTree Connect</h2>
        <div class="inv-form-group">
            <label>InvenTree Server URL</label>
            <input type="text" id="form-url" class="inv-input" value="${savedUrl}" placeholder="http://192.168.1.50:8080">
        </div>
        <div class="inv-form-group">
            <label>Username</label>
            <input type="text" id="form-user" class="inv-input" value="${savedUser}">
        </div>
        <div class="inv-form-group">
            <label>Password</label>
            <input type="password" id="form-pass" class="inv-input">
        </div>
        <button id="btn-connect" class="inv-btn">Connect & Authorize</button>
        <div id="login-err" class="inv-error"></div>
    `;

  document.getElementById("btn-connect").onclick = async () => {
    const url = document.getElementById("form-url").value.replace(/\/$/, "");
    const user = document.getElementById("form-user").value;
    const pass = document.getElementById("form-pass").value;
    const errDiv = document.getElementById("login-err");

    errDiv.innerText = "Authenticating...";

    try {
      // Create the Basic Auth header: "Basic <base64(user:pass)>"
      const credentials = btoa(`${user}:${pass}`);

      const response = await fetch(`${url}/api/user/token/`, {
        method: "GET", // Per documentation
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
            if (response.status === 401) throw new Error("Incorrect username or password");
            throw new Error(`Server error: ${response.status}`);
        }

      const result = await response.json(); // InvenTree returns {token: "..."}

      // 2. Save everything to storage
      await chrome.storage.local.set({
        invUrl: url,
        invToken: result.token,
        invUser: user,
      });

      initSidebar(); // Reload UI
    } catch (err) {
      errDiv.innerText = err.message;
    }
  };
}

function renderActiveUI(url) {
  const sidebar = document.getElementById("inventree-sidebar");
  sidebar.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0">InvenTree Queue</h3>
            <button id="btn-logout" style="font-size:10px; border:none; background:none; color:#999; cursor:pointer;">Logout</button>
        </div>
        <div style="font-size:11px; color:#28a745; margin-bottom:15px;">● Connected to ${url.replace("http://", "")}</div>
        <div id="item-list"></div>
    `;

  document.getElementById("btn-logout").onclick = () => {
    chrome.storage.local.clear();
    location.reload();
  };

  // Initialize the mutation observer and scraper
  const observer = new MutationObserver(scrapeOrders);
  observer.observe(document.body, { childList: true, subtree: true });
  scrapeOrders();
}

// The Scraper Function for AliExpress
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

// InvenTree Communication
async function sendToInvenTree(id, fullTitle, imgUrl) {
  const cleanName = document.getElementById(`name-${id}`).value;

  // TODO: get url and token from settings
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

initSidebar();
