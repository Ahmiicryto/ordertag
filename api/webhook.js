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

  try {
    const order = req.body;
    console.log("📦 New order received:", order.id);

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
    const existingTags = order.tags ? order.tags.split(",") : [];
    if (!existingTags.includes(tag)) existingTags.push(tag);

    // Update order tags in Shopify
    await axios.put(
      `https://${SHOPIFY_STORE}/admin/api/2024-10/orders/${order.id}.json`,
      {
        order: {
          id: order.id,
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

    console.log(`✅ Order ${order.id} tagged successfully as ${tag}`);

    return res.status(200).json({
      success: true,
      message: `Order tagged as ${tag}`,
    });
  } catch (error) {
    console.error("❌ Error tagging order:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Error tagging order",
      error: error.response?.data || error.message,
    });
  }
}
