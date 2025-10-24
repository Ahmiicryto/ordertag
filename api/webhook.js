import axios from "axios";

export default async function handler(req, res) {
  // Simple deployment check
  if (req.method === "GET") {
    return res.status(200).json({ message: "✅ Webhook is live and working!" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

  // Verify environment variables
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE) {
    console.error("❌ Missing environment variables");
    return res.status(500).json({
      success: false,
      message: "Server configuration error",
    });
  }

  try {
    const order = req.body;
    console.log("📦 New order received:", order.id);

    // Validate order data
    if (!order || !order.id) {
      console.error("❌ Invalid order data received");
      return res.status(400).json({
        success: false,
        message: "Invalid order data",
      });
    }

    // Determine tag (Organic or Paid Ads)
    const source = order.source_name?.toLowerCase() || "";
    let tag = "Organic";

    if (
      source.includes("google") ||
      source.includes("facebook") ||
      source.includes("instagram") ||
      source.includes("tiktok") ||
      source.includes("snapchat") ||
      source.includes("meta")
    ) {
      tag = "Paid Ads";
    }

    console.log(`🏷️ Tag to apply: ${tag}`);

    // Combine old + new tags
    const existingTags = order.tags ? order.tags.split(",").map(t => t.trim()) : [];
    if (!existingTags.includes(tag)) {
      existingTags.push(tag);
    }

    // Use the correct order ID format for Shopify API
    // The webhook sends the full order object, use the ID directly
    const orderId = order.id;

    // Update order tags in Shopify
    const updateResponse = await axios.put(
      `https://${SHOPIFY_STORE}/admin/api/2024-10/orders/${orderId}.json`,
      {
        order: {
          id: orderId,
          tags: existingTags.join(", "),
        },
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Order ${orderId} tagged successfully as ${tag}`);
    console.log("📝 Shopify response:", updateResponse.data);

    return res.status(200).json({
      success: true,
      message: `Order tagged as ${tag}`,
    });
  } catch (error) {
    console.error("❌ Error tagging order:", error.response?.data || error.message);
    
    // More detailed error logging
    if (error.response) {
      console.error("📋 Error details:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error tagging order",
      error: error.response?.data || error.message,
    });
  }
}
