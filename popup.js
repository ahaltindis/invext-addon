const STORAGE_KEYS = ["invUrl", "invToken", "invUser", "invScrapedItems"];
const app = document.getElementById("app");

async function getSettings() {
  const keys = await chrome.storage.local.get(STORAGE_KEYS);
  return {
    url: keys.invUrl || "",
    token: keys.invToken || "",
    user: keys.invUser || "",
    items: keys.invScrapedItems || [],
  };
}

async function verifyToken(url, token) {
  try {
    const res = await fetch(`${url}/api/user/me/`, {
      headers: { Authorization: `Token ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function init() {
  const settings = await getSettings();

  if (settings.url && settings.token) {
    const isValid = await verifyToken(settings.url, settings.token);
    if (isValid) {
      renderActiveUI(settings);
      return;
    }
  }

  renderLoginUI(settings);
}

function renderLoginUI(settings) {
  app.innerHTML = `
    <div class="header">
      <h2>InvenTree Connect</h2>
    </div>
    <div class="login-form">
      <div class="form-group">
        <label>InvenTree Server URL</label>
        <input type="text" id="form-url" value="${settings.url}" placeholder="http://192.168.1.50:8080">
      </div>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="form-user" value="${settings.user}">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="form-pass">
      </div>
      <button id="btn-connect" class="btn">Connect</button>
      <div id="login-err" class="error-msg"></div>
    </div>
  `;

  document.getElementById("btn-connect").onclick = async () => {
    const url = document.getElementById("form-url").value.replace(/\/$/, "");
    const user = document.getElementById("form-user").value;
    const pass = document.getElementById("form-pass").value;
    const errDiv = document.getElementById("login-err");

    errDiv.innerText = "Authenticating...";

    try {
      const credentials = btoa(`${user}:${pass}`);
      const response = await fetch(`${url}/api/user/token/`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Incorrect username or password");
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      await chrome.storage.local.set({
        invUrl: url,
        invToken: result.token,
        invUser: user,
      });

      init();
    } catch (err) {
      errDiv.innerText = err.message;
    }
  };
}

function renderActiveUI(settings) {
  const itemsHtml =
    settings.items.length === 0
      ? `<div class="empty-state">No orders found.<br><br>Visit <a href="#" onclick="chrome.tabs.create({url: 'https://aliexpress.com/p/order/history'}); return false;">AliExpress Order History</a> to scrape orders.</div>`
      : settings.items
          .map(
            (item) => `
        <div class="item-card ${item.addedToInvenTree ? "synced" : ""}" id="card-${item.id}">
          <img src="${item.imgUrl}">
          <div class="info">
            <input type="text" value="${item.title.substring(0, 50)}" id="name-${item.id}" title="${item.title}">
            <div class="meta">SKU: ${item.sku} | Qty: ${item.qty}</div>
            <button class="btn-send" data-id="${item.id}" ${item.addedToInvenTree ? "disabled" : ""}>
              ${item.addedToInvenTree ? "Added!" : "Add to InvenTree"}
            </button>
          </div>
        </div>
      `,
          )
          .join("");

  app.innerHTML = `
    <div class="header">
      <h2>InvenTree Queue</h2>
      <button id="btn-logout" class="logout-btn">Logout</button>
    </div>
    <div class="status connected">Connected to ${settings.url.replace("http://", "")}</div>
    <div class="items-container">
      ${itemsHtml}
    </div>
  `;

  document.getElementById("btn-logout").onclick = async () => {
    await chrome.storage.local.clear();
    init();
  };

  document.querySelectorAll(".btn-send").forEach((btn) => {
    btn.onclick = () => sendToInvenTree(btn.dataset.id, settings);
  });
}

async function sendToInvenTree(id, settings) {
  const cleanName = document.getElementById(`name-${id}`).value;
  const items = settings.items;
  const item = items.find((i) => i.id === id);

  if (!item) return;

  try {
    const response = await fetch(`${settings.url}/api/part/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${settings.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: cleanName,
        description: item.title,
        category: 1,
        active: true,
        is_template: false,
        purchaseable: true,
      }),
    });

    if (response.ok) {
      item.addedToInvenTree = true;
      await chrome.storage.local.set({ invScrapedItems: items });

      const card = document.getElementById(`card-${id}`);
      card.classList.add("synced");
      card.querySelector(".btn-send").innerText = "Added!";
      card.querySelector(".btn-send").disabled = true;
    }
  } catch (err) {
    console.error("InvenTree Error:", err);
  }
}

init();
