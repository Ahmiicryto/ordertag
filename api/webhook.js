import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

// ✅ Environment variables (set in Vercel Dashboard)
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

// ✅ Route to confirm deployment
app.get("/api/webhook", (req, res) => {
  res.send("🚀 Shopify Order Tagger is LIVE and running successfully!");
});

// ✅ Webhook endpoint
app.post("/api/webhook", async (req, res) => {
  try {
    const order = req.body;
    const site = order.landing_site || order.referring_site || "";
    const lowerSite = site.toLowerCase();

    // Detect Paid vs Organic
    let tag = "Organic";
    const paidSources = ["facebook", "instagram", "google", "tiktok", "snapchat"];
    if (paidSources.some(src => lowerSite.includes(src))) {
      tag = "Paid";
    }

    // Add tag to order
    const orderId = order.id;
    await axios.post(
      `https://${SHOPIFY_STORE}/admin/api/2024-10/orders/${orderId}/tags.json`,
      { tags: tag },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ Tagged order ${orderId} as ${tag}`);
    res.status(200).send(`Tag ${tag} applied successfully`);
  } catch (error) {
    console.error("❌ Error tagging order:", error.message);
    res.status(500).send("Error tagging order");
  }
});

export default app;
