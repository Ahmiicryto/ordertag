import axios from "axios";

export default async function handler(req, res) {
  // Deployment check
  if (req.method === "GET") {
    return res.status(200).json({ message: "✅ Webhook is live and working!" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

  // Environment check
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error - Check environment variables",
    });
  }

  try {
    const webhookPayload = req.body;
    console.log("📦 Webhook received for order:", webhookPayload.id);

    // Shopify webhook format
    const order = webhookPayload.order || webhookPayload;
    
    if (!order || !order.id) {
      return res.status(400).json({
        success: false,
        message: "No order data found",
      });
    }

    const orderId = order.id;
    const orderNumber = order.order_number || order.name || 'N/A';
    console.log(`🆔 Processing Order #${orderNumber} (ID: ${orderId})`);

    // 🏷️ SOURCE DETECTION LOGIC
    const source = order.source_name?.toLowerCase() || '';
    const landingSite = order.landing_site?.toLowerCase() || '';
    const referringSite = order.referring_site?.toLowerCase() || '';
    
    console.log(`🔍 Source: ${source}`);
    console.log(`🌐 Landing Site: ${landingSite}`);
    console.log(`🔗 Referring Site: ${referringSite}`);

    let trafficSource = "Organic"; // Default

    // ✅ PAID SOURCES (Facebook, Instagram, Google Ads)
    const paidSources = [
      "facebook",
      "instagram", 
      "google",
      "tiktok",
      "snapchat",
      "meta",
      "social",
      "ad",
      "cpc"
    ];

    // ✅ Check if it's paid traffic
    const isPaidSource = paidSources.some(paidSource => 
      source.includes(paidSource) ||
      landingSite.includes(paidSource) ||
      referringSite.includes(paidSource)
    );

    // ✅ Check for organic Google Search
    const isOrganicGoogle = 
      referringSite.includes('google.com') && 
      (referringSite.includes('q=') || referringSite.includes('search'));

    if (isPaidSource) {
      trafficSource = "Paid";
    } else if (isOrganicGoogle) {
      trafficSource = "Organic";
    }

    console.log(`🏷️ Detected Traffic Source: ${trafficSource}`);

    // 🎯 UPDATE TAGS
    const existingTags = order.tags ? order.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    
    // Remove old source tags if exist
    const cleanTags = existingTags.filter(tag => 
      !['Paid', 'Organic', 'Traffic Source'].includes(tag)
    );

    // Add new tag
    if (!cleanTags.includes(trafficSource)) {
      cleanTags.push(trafficSource);
    }

    const updatedTags = cleanTags.join(', ');
    console.log(`📝 Final Tags: ${updatedTags}`);

    // 🚀 UPDATE ORDER IN SHOPIFY
    const shopifyUrl = `https://${SHOPIFY_STORE}/admin/api/2024-10/orders/${orderId}.json`;
    
    const updateData = {
      order: {
        id: orderId,
        tags: updatedTags
      }
    };

    await axios.put(
      shopifyUrl,
      updateData,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        timeout: 10000
      }
    );

    console.log(`✅ Order #${orderNumber} successfully tagged as: ${trafficSource}`);

    return res.status(200).json({
      success: true,
      message: `Order tagged as ${trafficSource}`,
      orderNumber: orderNumber,
      trafficSource: trafficSource
    });

  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: "Error processing order",
      error: error.response?.data || error.message,
    });
  }
}
