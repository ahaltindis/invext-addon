# InvExt (Inventory Extension) Browser Add-on

Browser extension to import orders into [InvenTree](https://github.com/inventree/InvenTree).

## Features
- Automatically scrapes orders currently from AliExpress order pages
- Stores scraped items locally
- Push items to InvenTree as new parts with one click
- Badge shows count of items not yet synced

## Installation

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`

### Chrome/Edge

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `invext` folder

## Usage

1. Open the extension popup
2. Enter your InvenTree server URL, username, and password
3. Visit AliExpress order pages (`/p/order/`)
4. Items are automatically scraped and appear in the popup
5. Click "Add to InvenTree" to create a part

## Permissions

- `storage` - Local storage for settings and scraped items
- `activeTab` - Access current tab
- `*://*.aliexpress.com/*` - Read order pages

## Technical Details

**Architecture:** Manifest V3 extension

**Components:**
- `content.js` - Runs on AliExpress order pages, uses MutationObserver to detect new order elements, scrapes product data (ID, title, SKU, image, quantity), stores in chrome.storage.local
- `background.js` - Listens for storage changes, updates badge count for unsynced items
- `popup.js` - Handles InvenTree authentication (token-based), displays queue, POSTs new parts to InvenTree API

