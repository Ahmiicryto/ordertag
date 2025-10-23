// server.js
// Shopify Order Tagger - Automatically tags orders based on referring site
const express = require('express');
const fetch = require('node-fetch');
const getRawBody = require('raw-body');
const crypto = require('crypto');

const app = express();

const SHOP = process.env.SHOPIFY_STORE; // e.g. yourstore.myshopify.com
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Admin API token
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';
const PORT = process.env.PORT || 10000;

// Get raw body for webhook verification
app.use((req, res, next) => {
  if (req.path === '/webhook/orders/create') {
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
      encoding: true
    }, function(err, string) {
      if (err) return next(err);
      req.rawBody = string;
      try {
        req.body = JSON.parse(string);
      } catch {
        req.body = {};
      }
      next();
    });
  } else {
    express.json()(req, res, next);
  }
});

function verifyWebhook(req) {
  if (!WEBHOOK_SECRET) return true; // skip verification if not set
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const digest = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody, 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

function decideTag(order) {
  const ref = (order.referring_site || '').toLowerCase();
  const landing = (order.landing_site || '').toLowerCase();
  const source = ref || landing;

  if (!source) return 'Organic Order';
  if (source.includes('facebook')) return 'Paid - Facebook Ad Order';
  if (source.includes('instagram')) return 'Paid - Instagram Ad Order';
  if (source.includes('google')) return 'Paid - Google Ad Order';
  if (source.includes('tiktok')) return 'Paid - TikTok Ad Order';
  if (source.includes('snapchat')) return 'Paid - Snapchat Ad Order';
  return 'Organic Order';
}

async function addTagToOrder(orderId, newTag, existingTags = '') {
  try {
    const existing = (existingTags || '').split(',').map(t => t.trim()).filter(Boolean);
    if (!existing.includes(newTag)) existing.push(newTag);
    const tagsString = existing.join(', ');

    const url = `https://${SHOP}/admin/api/${API_VERSION}/orders/${orderId}.json`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ order: { id: orderId, tags: tagsString } })
    });

    if (!resp.ok) {
      console.error('Shopify API error:', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error adding tag:', err);
    return false;
  }
}

app.post('/webhook/orders/create', async (req, res) => {
  try {
    if (!verifyWebhook(req)) {
      console.warn('Webhook verification failed');
      return res.status(401).send('Webhook verification failed');
    }

    const order = req.body;
    const tag = decideTag(order);
    const ok = await addTagToOrder(order.id, tag, order.tags || '');
    console.log(`Order ${order.id} tagged with: ${tag}`);
    res.status(ok ? 200 : 500).send(ok ? 'OK' : 'Failed');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => res.send('✅ Shopify Order Tagger Running'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
