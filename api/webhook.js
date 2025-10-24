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

    // 🎯 UTM PARAMETERS EXTRACTION
    const extractUTMParams = (url) => {
      const params = {};
      try {
        const urlObj = new URL(url);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
          params[param] = urlObj.searchParams.get(param)?.toLowerCase() || '';
        });
      } catch (e) {
        // URL parse error - ignore
      }
      return params;
    };

    const landingUTM = extractUTMParams(landingSite);
    const referringUTM = extractUTMParams(referringSite);
    const utmParams = { ...landingUTM, ...referringUTM };

    console.log(`📊 UTM Parameters:`, utmParams);

    // ✅ STRICT PAID ADS DETECTION ONLY
    const isPaidAds = 
      // 1. PAID PLATFORMS DIRECT SOURCES
      source.includes('facebook') || 
      source.includes('instagram') ||
      source.includes('meta') ||
      source.includes('tiktok') ||
      source.includes('snapchat') ||
      source.includes('pinterest') ||
      source.includes('linkedin') ||
      source.includes('twitter') ||
      source.includes('youtube') ||
      
      // 2. PAID ADS TRACKING PARAMETERS
      landingSite.includes('gclid') || // Google Ads
      referringSite.includes('gclid') ||
      landingSite.includes('fbclid') || // Facebook Ads
      referringSite.includes('fbclid') ||
      landingSite.includes('ttclid') || // TikTok Ads
      referringSite.includes('ttclid') ||
      landingSite.includes('msclkid') || // Microsoft Ads
      referringSite.includes('msclkid') ||
      
      // 3. UTM MEDIUM = PAID
      utmParams.utm_medium.includes('cpc') ||
      utmParams.utm_medium.includes('ppc') ||
      utmParams.utm_medium.includes('paid') ||
      utmParams.utm_medium.includes('social') ||
      utmParams.utm_medium.includes('display') ||
      utmParams.utm_medium.includes('cpv') ||
      
      // 4. UTM SOURCE = PAID PLATFORMS
      utmParams.utm_source.includes('facebook') ||
      utmParams.utm_source.includes('instagram') ||
      utmParams.utm_source.includes('tiktok') ||
      utmParams.utm_source.includes('snapchat') ||
      utmParams.utm_source.includes('pinterest') ||
      utmParams.utm_source.includes('linkedin') ||
      utmParams.utm_source.includes('twitter') ||
      utmParams.utm_source.includes('youtube') ||
      utmParams.utm_source.includes('google') ||
      
      // 5. SPECIFIC PAID PATTERNS IN URL
      landingSite.includes('utm_medium=cpc') ||
      landingSite.includes('utm_medium=ppc') ||
      landingSite.includes('utm_medium=paid') ||
      referringSite.includes('utm_medium=cpc') ||
      referringSite.includes('utm_medium=ppc') ||
      referringSite.includes('utm_medium=paid') ||

      // 6. PAID CAMPAIGN INDICATORS
      utmParams.utm_campaign.includes('ads') ||
      utmParams.utm_campaign.includes('cpc') ||
      utmParams.utm_campaign.includes('ppc') ||
      utmParams.utm_campaign.includes('promo') ||
      utmParams.utm_campaign.includes('sale') ||
      utmParams.utm_campaign.includes('conversion') ||
      utmParams.utm_campaign.includes('retargeting');

    // 🎯 ONLY TAG IF PAID ADS
    if (isPaidAds) {
      console.log(`🏷️ PAID ADS DETECTED - Adding "Paid" tag`);
      console.log(`   - Source: ${source}`);
      console.log(`   - UTM: ${JSON.stringify(utmParams)}`);

      // UPDATE TAGS - Only add "Paid" tag
      const existingTags = order.tags ? order.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      
      // Remove old "Paid" tag if exists
      const cleanTags = existingTags.filter(tag => tag !== 'Paid');

      // Add new "Paid" tag
      cleanTags.push('Paid');

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
        detectedSource: source,
        utmParams: utmParams
      });

    } else {
      // 🚫 SKIP ORGANIC ORDERS - No tag update
      console.log(`⏭️  ORGANIC ORDER - Skipping tag update`);
      console.log(`   - Source: ${source}`);
      console.log(`   - UTM: ${JSON.stringify(utmParams)}`);

      return res.status(200).json({
        success: true,
        message: `Organic order - no tag added`,
        orderNumber: orderNumber,
        trafficSource: 'Organic',
        detectedSource: source,
        utmParams: utmParams
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
