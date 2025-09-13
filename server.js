require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const WOO_SECRET = process.env.WOO_WEBHOOK_SECRET;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ACCOUNTS = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const ZOHO_API_BASE = process.env.ZOHO_API_BASE || 'https://www.zohoapis.com/crm/v9';


let cachedAccessToken = null;
let tokenExpiry = 0;

async function getZohoAccessToken() {
  // Use refresh token to get access token (Zoho tokens expire ~1 hour).
  if (cachedAccessToken && Date.now() < tokenExpiry - 60*1000) {
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
  // Zoho docs: access tokens valid ~3600s
  tokenExpiry = Date.now() + (resp.data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function findContactByEmail(email, accessToken) {
  try {
    const url = `${ZOHO_API_BASE}/Contacts/search?email=${encodeURIComponent(email)}`;
    const resp = await axios.get(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }});
    if (resp.data && resp.data.data && resp.data.data.length) return resp.data.data[0];
    return null;
  } catch (err) {
    if (err.response && err.response.status === 404) return null; // no record
    throw err;
  }
}

async function createContact(contactBody, accessToken) {
  const url = `${ZOHO_API_BASE}/Contacts`;
  const resp = await axios.post(url, { data: [contactBody] }, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }});
  return resp.data;
}

async function createDeal(dealBody, accessToken) {
  const url = `${ZOHO_API_BASE}/Deals`;
  const resp = await axios.post(url, { data: [dealBody] }, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }});
  return resp.data;
}

const app = express();

// We only need raw body for webhook endpoint to verify signature.
// Use raw parser for all content types to be safe.
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signature = req.get('x-wc-webhook-signature') || req.get('X-WC-Webhook-Signature');
    if (!signature) {
      return res.status(400).send('No signature header');
    }
    // compute HMAC SHA256, base64
    const hmac = crypto.createHmac('sha256', WOO_SECRET).update(req.body).digest('base64');
    if (hmac !== signature) {
      console.warn('Signature mismatch', hmac, signature);
      return res.status(401).send('Invalid signature');
    }
    const payload = JSON.parse(req.body.toString('utf8')); // order payload

    // Extract useful data:
    const orderId = payload.id;
    const billing = payload.billing || {};
    const email = billing.email;
    const firstName = billing.first_name || '';
    const lastName = billing.last_name || '';
    const total = payload.total || payload.total_price || payload.total_amount || payload.total; // safe fallback
    const products = (payload.line_items || []).map(li => ({ name: li.name, qty: li.quantity, price: li.price || li.total }));

    // 1) Authenticate with Zoho
    const token = await getZohoAccessToken();

    // 2) Find or create contact (search by email)
    let contact = email ? await findContactByEmail(email, token) : null;
    if (!contact) {
      // Zoho Contacts require Last_Name as mandatory
      const contactBody = {
        Last_Name: lastName || (firstName ? firstName : 'Unknown'),
        First_Name: firstName,
        Email: email,
        // you can add custom fields like Latest_Order_ID, Latest_Order_Total etc if you pre-create them in Zoho CRM
        // e.g. Latest_Order_ID: orderId
      };
      const createResp = await createContact(contactBody, token);
      // createResp.data[0].details.id contains new id
      const createdId = createResp.data && createResp.data[0] && createResp.data[0].details && createResp.data[0].details.id;
      contact = { id: createdId, Email: email, First_Name: firstName, Last_Name: contactBody.Last_Name };
    }

    // 3) Create a Deal in Zoho (or rely on a Zoho workflow/Deluge function to create it)
    const dealBody = {
      Deal_Name: `Order #${orderId} — ${firstName} ${lastName}`,
      Amount: Number(total) || 0,
      Stage: 'Qualification', // ensure this pipeline stage exists in your Zoho
      Contact_Name: { id: contact.id }
      // You can add custom fields or Product details here (see Zoho API docs for line items).
    };
    const dealResp = await createDeal(dealBody, token);

    console.log('Created/linked Contact ID:', contact.id, 'Deal response:', dealResp);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook handler error', err?.response?.data || err.message || err);
    return res.status(500).send('Server error');
  }
});

app.listen(PORT, ()=> console.log(`Webhook listener running on ${PORT}`));
