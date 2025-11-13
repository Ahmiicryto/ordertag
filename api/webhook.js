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

  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error",
    });
  }

  try {
    const webhookPayload = req.body;
    console.log("📦 Webhook received for order:", webhookPayload.id);

    const order = webhookPayload.order || webhookPayload;
    
    if (!order || !order.id) {
      return res.status(400).json({
        success: false,
        message: "No order data found",
      });
    }

    const orderId = order.id;
    const orderNumber = order.order_number || order.name || 'N/A';
    
    // 🏷️ SOURCE DETECTION
    const source = String(order.source_name || '').toLowerCase();
    const landingSite = String(order.landing_site || '').toLowerCase();
    const referringSite = String(order.referring_site || '').toLowerCase();

    console.log(`🔍 Source: "${source}"`);
    console.log(`🌐 Landing Site: "${landingSite}"`);
    console.log(`🔗 Referring Site: "${referringSite}"`);

    // 🎯 PAID PLATFORMS LIST
    const paidPlatforms = [
      'facebook',
      'instagram', 
      'meta',
      'tiktok',
      'snapchat',
      'pinterest',
      'linkedin',
      'twitter',
      'youtube',
      'google'
    ];

    // ✅ PLATFORM DETECTION WITH LINK
    let detectedPlatform = null;
    let detectedLink = '';

    // Check source name
    for (const platform of paidPlatforms) {
      if (source.includes(platform)) {
        detectedPlatform = platform;
        detectedLink = `Source: ${source}`;
        break;
      }
    }

    // Check referring site
    if (!detectedPlatform) {
      for (const platform of paidPlatforms) {
        if (referringSite.includes(platform)) {
          detectedPlatform = platform;
          detectedLink = `Referring: ${referringSite}`;
          break;
        }
      }
    }

    // Check landing site
    if (!detectedPlatform) {
      for (const platform of paidPlatforms) {
        if (landingSite.includes(platform)) {
          detectedPlatform = platform;
          detectedLink = `Landing: ${landingSite}`;
          break;
        }
      }
    }

    // 🎯 ONLY TAG IF PAID PLATFORM DETECTED
    if (detectedPlatform) {
      console.log(`🏷️ PAID PLATFORM DETECTED: ${detectedPlatform}`);
      console.log(`🔗 Detected from: ${detectedLink}`);
      
      // UPDATE TAGS - "Paid" + Platform name + Link
      const existingTags = order.tags ? order.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      
      // Remove old paid-related tags
      const cleanTags = existingTags.filter(tag => 
        !tag.startsWith('Paid') && 
        !paidPlatforms.some(platform => tag.toLowerCase().includes(platform))
      );

      // Add new tags
      cleanTags.push('Paid');
      
      // Shorten link for tag (max 50 characters)
      const shortLink = detectedLink.length > 50 ? 
        detectedLink.substring(0, 47) + '...' : detectedLink;
      cleanTags.push(shortLink);

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

      console.log(`✅ Order #${orderNumber} tagged as: Paid`);

      return res.status(200).json({
        success: true,
        message: `Order tagged as Paid`,
        orderNumber: orderNumber,
        trafficSource: 'Paid',
        platform: detectedPlatform,
        detectedFrom: detectedLink
      });

    } else {
      // 🚫 SKIP ORGANIC ORDERS
      console.log(`⏭️  ORGANIC ORDER - No paid platform detected`);

      return res.status(200).json({
        success: false,
        message: `Organic order - no tag added`,
        orderNumber: orderNumber,
        trafficSource: 'Organic'
      });
    }

  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: "Error processing order",
      error: error.response?.data || error.message,
    });
  }
}
