import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

// Replace this with your Shopify API access token & store name
const SHOPIFY_ACCESS_TOKEN = "your_shopify_token_here";
const SHOPIFY_STORE = "your-store-name.myshopify.com";

app.post("/api/webhook", async (req, res) => {
  try {
    const order = req.body;

    // Step 1: Detect source
    const site = order.landing_site || order.referring_site || "";
    const lowerSite = site.toLowerCase();

    let tag = "Organic";
    const paidSources = ["facebook", "instagram", "google", "tiktok", "snapchat"];
    if (paidSources.some(src => lowerSite.includes(src))) {
      tag = "Paid";
    }

    // Step 2: Add tag to Shopify order
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

    console.log(`✅ Order ${orderId} tagged as ${tag}`);
    res.status(200).send(`Tag ${tag} applied successfully`);
  } catch (error) {
    console.error("❌ Error tagging order:", error.message);
    res.status(500).send("Error tagging order");
  }
});

export default app;
