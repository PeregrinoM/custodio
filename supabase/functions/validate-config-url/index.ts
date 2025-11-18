import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { baseUrl, folderId, folderPath } = await req.json();

    // Whitelist allowed domains to prevent SSRF attacks
    const allowedDomains = ['m.egwwritings.org', 'egwwritings.org'];
    
    // Construct and validate the URL
    const fullUrl = `${baseUrl}${folderPath}${folderId}`;
    
    try {
      const url = new URL(fullUrl);
      if (!allowedDomains.includes(url.hostname)) {
        throw new Error(`Invalid domain. Only ${allowedDomains.join(', ')} are allowed.`);
      }
    } catch (urlError) {
      const errorMsg = urlError instanceof Error ? urlError.message : 'Invalid URL format';
      console.error('[VALIDATE-CONFIG] URL validation failed:', errorMsg);
      return new Response(
        JSON.stringify({
          isValid: false,
          error: errorMsg,
          message: '❌ Invalid URL. Please use only egwwritings.org domains.'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    console.log(`[VALIDATE-CONFIG] Testing URL: ${fullUrl}`);

    // Make request to verify URL is accessible
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'EGW-Monitor/1.0'
      }
    });

    const isValid = response.ok;
    const statusCode = response.status;
    
    // Get content length to verify it's not empty
    const html = await response.text();
    const contentLength = html.length;
    
    // Check if page contains expected content
    const hasExpectedContent = html.includes('book') || html.includes('libro');

    const result = {
      isValid: isValid && hasExpectedContent && contentLength > 1000,
      statusCode,
      contentLength,
      hasExpectedContent,
      url: fullUrl,
      message: isValid && hasExpectedContent 
        ? '✅ Configuration is valid. URL is accessible and contains book data.'
        : `❌ Configuration validation failed. Status: ${statusCode}, Content found: ${hasExpectedContent}`
    };

    console.log('[VALIDATE-CONFIG] Result:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("[VALIDATE-CONFIG] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        isValid: false,
        error: errorMessage,
        message: '❌ Failed to validate configuration. Please check the URL and try again.'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 so frontend can display error message
      }
    );
  }
});
