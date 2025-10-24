import axios from "axios";

export const config = {
  api: {
    bodyParser: false, // disable automatic body parsing
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Convert raw request stream to JSON
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const data = Buffer.concat(buffers).toString();
    const order = JSON.parse(data);

    // Detect ad source
    const source =
      (order.source_name?.toLowerCase() || order.landing_site?.toLowerCase() || "");

    const adSources = ["facebook", "instagram", "google", "tiktok", "snapchat"];
    const isAdOrder = adSources.some((src) => source.includes(src));

    if (isAdOrder) {
      const orderId = order.id;

      // Add tag to order
      await axios.put(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2024-10/orders/${orderId}.json`,
        {
          order: {
            id: orderId,
            tags: `${order.tags ? order.tags + ", " : ""}Paid`
          }
        },
        {
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(`✅ Paid tag added to order: ${orderId}`);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
