require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// ======================
//  CONFIG
// ======================
const PORT = process.env.PORT || 3000;
const WOO_SECRET = process.env.WOO_WEBHOOK_SECRET;

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ACCOUNTS = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const ZOHO_API_BASE = process.env.ZOHO_API_BASE || 'https://www.zohoapis.com/crm/v9';

let cachedAccessToken = null;
let tokenExpiry = 0;

// ======================
//  ZOHO AUTH HELPERS
// ======================
async function getZohoAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry - 60 * 1000) {
    return cachedAccessToken;
  }
  const url = `${ZOHO_ACCOUNTS}/oauth/v2/token`;
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });
  const resp = await axios.post(`${url}?${params.toString()}`);
  cachedAccessToken = resp.data.access_token;
  tokenExpiry = Date.now() + (resp.data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

// ======================
//  ZOHO API CALLS
// ======================
async function findContactByEmail(email, token) {
  try {
    const url = `${ZOHO_API_BASE}/Contacts/search?email=${encodeURIComponent(email)}&fields=Email,First_Name,Last_Name`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    if (resp.data && resp.data.data && resp.data.data.length) {
      return resp.data.data[0];
    }
    return null;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

async function createContact(body, token) {
  const url = `${ZOHO_API_BASE}/Contacts`;
  const resp = await axios.post(url, { data: [body] }, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return resp.data;
}

async function createDeal(body, token) {
  const url = `${ZOHO_API_BASE}/Deals`;
  const resp = await axios.post(url, { data: [body] }, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return resp.data;
}

// ======================
//  WEBHOOK ENDPOINT
// ======================
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Verify WooCommerce signature
    const signature = req.get('x-wc-webhook-signature');
    const hmac = crypto.createHmac('sha256', WOO_SECRET).update(req.body).digest('base64');
    if (hmac !== signature) {
      console.error('Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(req.body.toString('utf8'));
    const orderId = payload.id;
    const billing = payload.billing || {};
    const email = billing.email;
    const firstName = billing.first_name || '';
    const lastName = billing.last_name || 'Unknown';
    const total = payload.total;

    console.log(`📦 Received Order #${orderId} from ${firstName} ${lastName}`);

    // Get Zoho token
    const token = await getZohoAccessToken();

    // Find or create Contact
    let contact = email ? await findContactByEmail(email, token) : null;
    if (!contact) {
      const contactBody = {
        Last_Name: lastName,
        First_Name: firstName,
        Email: email
      };
      const resp = await createContact(contactBody, token);
      contact = { id: resp.data[0].details.id };
      console.log(`👤 Created new Contact: ${contact.id}`);
    } else {
      console.log(`👤 Found existing Contact: ${contact.id}`);
    }

    // Create Deal
    const dealBody = {
      Deal_Name: `Order #${orderId}`,
      Amount: Number(total) || 0,
      Stage: 'Qualification',
      Contact_Name: { id: contact.id }
    };
    const dealResp = await createDeal(dealBody, token);
    console.log(`💼 Created Deal:`, dealResp);

    // write log
    const logPath = writeLog(orderId, payload, { contactId: contact.id, dealResp });
    console.log(`📝 Wrote log ${logPath}`);

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Webhook handler error:', err.response?.data || err.message || err);
    try {
      // attempt to write error log
      writeLog(orderId, payload || { raw: req.body.toString('utf8') }, { error: err.response?.data || err.message });
    } catch (e) { /* ignore logging failure */ }
    return res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook listener running on port ${PORT}`);
});
