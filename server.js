const express = require('express');
const crypto = require('crypto');


const app = express();
app.use(express.raw({ type: 'application/json' }));
const PORT = process.env.PORT || 3000;// Default to port 3000 if not specified

const WEBHOOK_SECRET = "Elshewemy123"; // same as WooCommerce webhook secret

app.post('/webhook', (req, res) => {
    const signature = req.headers['x-wc-webhook-signature'];
    const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(req.body)
        .digest('base64');
    if (signature !== expected) {
        console.error('Invalid signature');
        return res.status(401).send('Invalid signature');
    }

    const event = req.headers['x-wc-webhook-event'];
    console.log('Received event:', event);

    const payload = JSON.parse(req.body.toString());
    

    console.log('Received order webhook:', payload.id, payload.total);

    res.status(200).send('Webhook received');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// Middleware to parse raw body for signature verification
