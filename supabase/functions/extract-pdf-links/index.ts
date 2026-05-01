import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString, PDFArray } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/**
 * Extract all hyperlink URLs from PDF annotations.
 */
function extractHyperlinksFromPdf(pdfDoc: PDFDocument): { page: number; url: string }[] {
  const links: { page: number; url: string }[] = [];
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    try {
      const annots = pages[i].node.Annots();
      if (!annots) continue;

      const annotsArray = annots instanceof PDFArray ? annots : null;
      if (!annotsArray) continue;

      for (let j = 0; j < annotsArray.size(); j++) {
        try {
          const annotRef = annotsArray.get(j);
          const annotDict = pdfDoc.context.lookupMaybe(annotRef, PDFDict);
          if (!annotDict) continue;

          const subtype = annotDict.get(PDFName.of("Subtype"));
          if (subtype && subtype.toString() !== "/Link") continue;

          const aRef = annotDict.get(PDFName.of("A"));
          if (!aRef) continue;

          const aDict = pdfDoc.context.lookupMaybe(aRef, PDFDict);
          if (!aDict) continue;

          const uriObj = aDict.get(PDFName.of("URI"));
          if (!uriObj) continue;

          let uri = "";
          if (uriObj instanceof PDFString) {
            uri = uriObj.decodeText();
          } else if (uriObj instanceof PDFHexString) {
            uri = uriObj.decodeText();
          } else {
            uri = uriObj.toString();
            if (uri.startsWith("(") && uri.endsWith(")")) {
              uri = uri.slice(1, -1);
            }
          }

          if (uri && uri.startsWith("http")) {
            links.push({ page: i + 1, url: uri });
          }
        } catch {
          // Skip malformed annotations
        }
      }
    } catch {
      // Skip pages with annotation errors
    }
  }

  return links;
}

/**
 * Filter links to photo/folder-related ones.
 */
function filterPhotoLinks(links: { page: number; url: string }[]): { page: number; url: string }[] {
  const photoPatterns = [
    /drive\.google\.com/i,
    /docs\.google\.com/i,
    /dropbox\.com/i,
    /onedrive\.live\.com/i,
    /1drv\.ms/i,
    /icloud\.com/i,
    /photos\.google\.com/i,
    /flickr\.com/i,
    /imgur\.com/i,
    /youtube\.com/i,
    /youtu\.be/i,
  ];
  return links.filter(l => photoPatterns.some(p => p.test(l.url)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Hybrid auth: X-Webhook-Secret or Authorization Bearer service_role
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WHATSAPP_AGENT_SECRET");
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isWebhookAuth = webhookSecret && expectedSecret && webhookSecret === expectedSecret;
    const isServiceAuth = authHeader === `Bearer ${serviceRoleKey}`;
    // Also allow normal user auth (for edge function calling)
    const isUserAuth = authHeader?.startsWith("Bearer ") && !isServiceAuth;

    if (!isWebhookAuth && !isServiceAuth && !isUserAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { signed_url } = await req.json();
    if (!signed_url || typeof signed_url !== "string") {
      return new Response(JSON.stringify({ error: "signed_url é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download PDF
    const pdfResp = await fetch(signed_url);
    if (!pdfResp.ok) {
      return new Response(JSON.stringify({ error: `Falha ao baixar PDF: ${pdfResp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBuffer = await pdfResp.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    const allLinks = extractHyperlinksFromPdf(pdfDoc);
    const photoLinks = filterPhotoLinks(allLinks);

    const result = {
      all_links: allLinks,
      photo_links: photoLinks,
      has_embedded_links: allLinks.length > 0,
      total_embedded: allLinks.length,
      total_photo: photoLinks.length,
    };

    console.log(`[extract-pdf-links] Extracted ${allLinks.length} total links, ${photoLinks.length} photo links`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-pdf-links] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        all_links: [],
        photo_links: [],
        has_embedded_links: false,
        total_embedded: 0,
        total_photo: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
