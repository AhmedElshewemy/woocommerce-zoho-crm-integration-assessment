# WooCommerce → Zoho CRM Integration (Assessment Project)

## 📌 Overview
This project was built as part of a **technical assessment**.  
It demonstrates how to integrate **WooCommerce** with **Zoho CRM** using:

- 🖥️ Node.js (webhook listener + Zoho API calls)
- 🔑 OAuth2 authentication with refresh tokens
- 📦 Webhooks from WooCommerce
- 👤 Contact + 💼 Deal creation in Zoho CRM
- 📝 Logging for verification
- ⚡ Example Deluge script (Zoho’s scripting language) for CRM-side automation

---

## ⚙️ Features
- 📦 Captures **WooCommerce order webhooks**
- 🔒 Verifies WooCommerce **HMAC signatures**
- 👤 Creates/updates **Contacts** in Zoho CRM
- 💼 Creates **Deals** linked to the Contact
- 🔄 Uses **OAuth2 refresh tokens** (no manual token refresh)
- 📝 Logs every webhook payload + Zoho response to `logs/`
- ⚡ Includes **Deluge example** for internal Zoho automation
- 🧪 Postman collection provided for API testing

---

## 📂 Project Structure
.
├── server.js # Node.js webhook listener
├── refresh-token.sh # Helper script to refresh Zoho access tokens
├── postman_collection.json# Postman tests (refresh, contacts, deals)
├── .env.example # Environment variables template
├── logs/ # Auto-created logs for each order
└── README.md # Documentation

yaml
Copy code

---

## 🚀 Setup & Run

### 1. Prerequisites
- Node.js 18+  
- WooCommerce running locally (e.g., **LocalWP**)  
- Ngrok (or another tunneling tool)  
- A Zoho CRM account with API credentials  

---

### 2. Configure WooCommerce
1. Install WordPress locally with **LocalWP**.  
2. Install WooCommerce plugin.  
3. Add **at least 2 sample products**.  
4. Place **2 test orders** (required by the assessment).  

---

### 3. Create `.env`
Copy `.env.example` → `.env` and fill with your values:

```env
PORT=3000
WOO_WEBHOOK_SECRET=mySecret123

ZOHO_CLIENT_ID=1000.YOUR_CLIENT_ID
ZOHO_CLIENT_SECRET=YOUR_CLIENT_SECRET
ZOHO_REFRESH_TOKEN=1000.YOUR_REFRESH_TOKEN
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_API_BASE=https://www.zohoapis.com/crm/v9
````

### 4. Refresh Token Management
The project includes a helper script `refresh-token.sh` to manage Zoho CRM access tokens:

```bash
# Get initial access token
chmod +x refresh-token.sh
./refresh-token.sh
```

This script will:
- Request a new access token using your refresh token
- Automatically update `.env` with the new token
- Show success/error messages for debugging

> Note: Run this script if you get authentication errors from Zoho CRM.

## 🧪 Testing
1. Start your local WordPress + WooCommerce
2. Start ngrok: `ngrok http 3000`
3. Update WooCommerce webhook URL with ngrok URL
4. Place a test order
5. Check logs/ directory for transaction details

## ❗ Troubleshooting
- **Webhook 401**: Check your WOO_WEBHOOK_SECRET
- **Zoho API Error**: Verify your OAuth credentials and refresh token
- **No logs**: Check folder permissions