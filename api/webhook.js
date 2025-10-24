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
    
    // 🏷️ SAFE SOURCE DETECTION
    const source = String(order.source_name || '').toLowerCase();
    const landingSite = String(order.landing_site || '').toLowerCase();
    const referringSite = String(order.referring_site || '').toLowerCase();

    console.log(`🔍 Source: "${source}"`);
    console.log(`🌐 Landing Site: "${landingSite}"`);
    console.log(`🔗 Referring Site: "${referringSite}"`);

    // 🎯 ADVANCED PARAMETERS EXTRACTION
    const extractAllParams = (url) => {
      const params = {
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_term: '',
        utm_content: '',
        utm_id: '',
        // Facebook
        fbclid: '',
        campaign_id: '',
        ad_id: '',
        // Google
        gclid: '',
        // TikTok
        ttclid: '',
        // Microsoft
        msclkid: '',
        // Snapchat
        scclid: ''
      };
      
      if (!url || typeof url !== 'string') return params;
      
      try {
        const urlObj = new URL(url);
        
        // Standard UTM parameters
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'].forEach(param => {
          const value = urlObj.searchParams.get(param);
          params[param] = value ? String(value).toLowerCase() : '';
        });
        
        // Platform specific parameters
        params.fbclid = urlObj.searchParams.get('fbclid') || '';
        params.campaign_id = urlObj.searchParams.get('campaign_id') || '';
        params.ad_id = urlObj.searchParams.get('ad_id') || '';
        params.gclid = urlObj.searchParams.get('gclid') || '';
        params.ttclid = urlObj.searchParams.get('ttclid') || '';
        params.msclkid = urlObj.searchParams.get('msclkid') || '';
        params.scclid = urlObj.searchParams.get('scclid') || '';
        
      } catch (e) {
        // URL parse error
      }
      return params;
    };

    const landingParams = extractAllParams(landingSite);
    const referringParams = extractAllParams(referringSite);
    
    // Merge parameters
    const allParams = {
      utm_source: referringParams.utm_source || landingParams.utm_source,
      utm_medium: referringParams.utm_medium || landingParams.utm_medium,
      utm_campaign: referringParams.utm_campaign || landingParams.utm_campaign,
      utm_term: referringParams.utm_term || landingParams.utm_term,
      utm_content: referringParams.utm_content || landingParams.utm_content,
      utm_id: referringParams.utm_id || landingParams.utm_id,
      fbclid: referringParams.fbclid || landingParams.fbclid,
      campaign_id: referringParams.campaign_id || landingParams.campaign_id,
      ad_id: referringParams.ad_id || landingParams.ad_id,
      gclid: referringParams.gclid || landingParams.gclid,
      ttclid: referringParams.ttclid || landingParams.ttclid,
      msclkid: referringParams.msclkid || landingParams.msclkid,
      scclid: referringParams.scclid || landingParams.scclid
    };

    console.log(`📊 All Parameters:`, allParams);

    // 🎯 ALL PAID PLATFORMS DETECTION
    const isPaidAds = 
      // ✅ FACEBOOK & INSTAGRAM ADS
      (allParams.fbclid && allParams.fbclid.length > 5) ||
      (allParams.campaign_id && allParams.campaign_id.length > 15) ||
      (allParams.utm_source === 'facebook' && allParams.utm_medium === 'paid') ||
      (allParams.utm_source === 'instagram' && allParams.utm_medium === 'paid') ||
      source.includes('facebook') ||
      source.includes('instagram') ||
      source.includes('meta') ||

      // ✅ GOOGLE ADS
      (allParams.gclid && allParams.gclid.length > 5) ||
      (allParams.utm_source === 'google' && allParams.utm_medium === 'cpc') ||
      (allParams.utm_source === 'google' && allParams.utm_medium === 'ppc') ||
      source.includes('google') ||

      // ✅ TIKTOK ADS
      (allParams.ttclid && allParams.ttclid.length > 5) ||
      (allParams.utm_source === 'tiktok' && allParams.utm_medium === 'paid') ||
      source.includes('tiktok') ||

      // ✅ SNAPCHAT ADS
      (allParams.scclid && allParams.scclid.length > 5) ||
      (allParams.utm_source === 'snapchat' && allParams.utm_medium === 'paid') ||
      source.includes('snapchat') ||

      // ✅ PINTEREST ADS
      (allParams.utm_source === 'pinterest' && allParams.utm_medium === 'paid') ||
      source.includes('pinterest') ||

      // ✅ LINKEDIN ADS
      (allParams.utm_source === 'linkedin' && allParams.utm_medium === 'paid') ||
      source.includes('linkedin') ||

      // ✅ TWITTER ADS
      (allParams.utm_source === 'twitter' && allParams.utm_medium === 'paid') ||
      source.includes('twitter') ||

      // ✅ YOUTUBE ADS
      (allParams.utm_source === 'youtube' && allParams.utm_medium === 'paid') ||
      source.includes('youtube') ||

      // ✅ UNIVERSAL PAID INDICATORS
      (allParams.utm_medium && (
        allParams.utm_medium.includes('cpc') ||
        allParams.utm_medium.includes('ppc') ||
        allParams.utm_medium.includes('paid') ||
        allParams.utm_medium.includes('social') ||
        allParams.utm_medium.includes('display') ||
        allParams.utm_medium.includes('cpv')
      )) ||

      // ✅ MICROSOFT ADS
      (allParams.msclkid && allParams.msclkid.length > 5);

    // 🎯 DETECT SPECIFIC PLATFORM
    let detectedPlatform = 'Unknown';
    
    if (allParams.fbclid || source.includes('facebook') || source.includes('instagram')) {
      detectedPlatform = 'Facebook/Instagram Ads';
    } else if (allParams.gclid || source.includes('google')) {
      detectedPlatform = 'Google Ads';
    } else if (allParams.ttclid || source.includes('tiktok')) {
      detectedPlatform = 'TikTok Ads';
    } else if (allParams.scclid || source.includes('snapchat')) {
      detectedPlatform = 'Snapchat Ads';
    } else if (source.includes('pinterest')) {
      detectedPlatform = 'Pinterest Ads';
    } else if (source.includes('linkedin')) {
      detectedPlatform = 'LinkedIn Ads';
    } else if (source.includes('twitter')) {
      detectedPlatform = 'Twitter Ads';
    } else if (source.includes('youtube')) {
      detectedPlatform = 'YouTube Ads';
    } else if (allParams.msclkid) {
      detectedPlatform = 'Microsoft Ads';
    }

    // 🎯 ONLY TAG IF PAID ADS
    if (isPaidAds) {
      console.log(`🏷️ PAID ADS DETECTED - Platform: ${detectedPlatform}`);
      
      // Detailed logging
      if (allParams.fbclid) console.log(`   - Facebook Click ID detected`);
      if (allParams.gclid) console.log(`   - Google Click ID detected`);
      if (allParams.ttclid) console.log(`   - TikTok Click ID detected`);
      if (allParams.scclid) console.log(`   - Snapchat Click ID detected`);
      if (allParams.msclkid) console.log(`   - Microsoft Click ID detected`);
      if (allParams.utm_source) console.log(`   - UTM Source: ${allParams.utm_source}`);
      if (allParams.utm_medium) console.log(`   - UTM Medium: ${allParams.utm_medium}`);
      if (source) console.log(`   - Source: ${source}`);

      // UPDATE TAGS
      const existingTags = order.tags ? order.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const cleanTags = existingTags.filter(tag => tag !== 'Paid');
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

      console.log(`✅ Order #${orderNumber} tagged as: Paid (${detectedPlatform})`);

      return res.status(200).json({
        success: true,
        message: `Order tagged as Paid`,
        orderNumber: orderNumber,
        trafficSource: 'Paid',
        platform: detectedPlatform
      });

    } else {
      // 🚫 SKIP ORGANIC ORDERS
      console.log(`⏭️  ORGANIC ORDER - Skipping tag update`);

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
