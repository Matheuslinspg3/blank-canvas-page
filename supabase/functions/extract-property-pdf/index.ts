import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString, PDFArray } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseHost = (() => {
  try {
    return new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname;
  } catch {
    return "";
  }
})();

const ALLOWED_HOSTS = [supabaseHost, "res.cloudinary.com"].filter(Boolean);

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) return false;
    return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/**
 * Extract all hyperlink URLs from PDF annotations (links embedded in the document).
 * Returns an array of { page, url } objects.
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

          // Check if it's a Link annotation
          const subtype = annotDict.get(PDFName.of("Subtype"));
          if (subtype && subtype.toString() !== "/Link") continue;

          // Get the Action dictionary
          const aRef = annotDict.get(PDFName.of("A"));
          if (!aRef) continue;

          const aDict = pdfDoc.context.lookupMaybe(aRef, PDFDict);
          if (!aDict) continue;

          // Get the URI
          const uriObj = aDict.get(PDFName.of("URI"));
          if (!uriObj) continue;

          let uri = "";
          if (uriObj instanceof PDFString) {
            uri = uriObj.decodeText();
          } else if (uriObj instanceof PDFHexString) {
            uri = uriObj.decodeText();
          } else {
            uri = uriObj.toString();
            // Remove parentheses if present (raw PDF string format)
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
 * Filter links to only include photo/folder-related ones (Drive, Dropbox, OneDrive, etc.)
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
  ];
  return links.filter(l => photoPatterns.some(p => p.test(l.url)));
}

const EXTRACT_PROMPT = `Você é um extrator especializado em dados de imóveis. Analise o PDF/tabela de imóveis em anexo e retorne APENAS um JSON válido (sem markdown, sem comentários) no formato:
{
  "properties": [
    {
      "title": "string (nome do empreendimento + unidade, ex: 'Res. Frédéric François Chopin - Unidade 63B')",
      "type": "Apartamento|Casa|Terreno|Comercial|Rural|Cobertura|Sobrado",
      "purpose": "venda|aluguel",
      "price": number (menor valor entre à vista e financiamento),
      "price_cash": number (valor à vista, se disponível),
      "price_financed": number (valor financiamento, se disponível),
      "address": "string (rua e número)",
      "neighborhood": "string",
      "city": "string",
      "state": "string (UF)",
      "bedrooms": number,
      "bathrooms": number,
      "parking_spaces": number,
      "area_total": number,
      "area_built": number,
      "unit": "string (número/código da unidade)",
      "code": "string (código do imóvel se houver)",
      "description": "string (descrição comercial COMPLETA - veja instruções abaixo)",
      "photos_url": "string (link da pasta de fotos, Google Drive, Dropbox, etc.)"
    }
  ]
}

REGRAS CRÍTICAS:

1. **CADA UNIDADE É UM IMÓVEL SEPARADO**: Se um edifício tem unidades 63B, 64A e 64B, são 3 imóveis distintos no array. Se há unidades 71, 111, 131, 151 do mesmo prédio, são 4 imóveis. NUNCA agrupe unidades diferentes em um só registro.

2. **DESCRIÇÃO RICA E COMPLETA**: O campo "description" deve ser um texto comercial detalhado incluindo TUDO que estiver disponível:
   - Nome completo do empreendimento
   - Número da unidade
   - Área útil/total em m²
   - Quantidade e tipo de dormitórios (suíte, etc.)
   - Dependências (sala, cozinha, lavabo, área de serviço, sacada, churrasqueira, etc.)
   - Vagas de garagem (tipo: coletiva, coberta, etc.)
   - Infraestrutura de lazer completa (piscina, fitness, playground, salão de festas, etc.)
   - Condições de pagamento (valor à vista, financiamento, parcelamento, entrada, saldo)
   - Status das chaves/obra (pronto, em obra, na portaria, etc.)
   - Endereço completo
   - IPTU se disponível
   - Qualquer diferencial mencionado
   Exemplo: "Apartamento no Res. Frédéric François Chopin, Unidade 63B. Área útil de 60m², com 2 dormitórios sendo 1 suíte, sacada e 1 vaga de garagem. Valor: R$ 450.000 à vista ou R$ 480.000 via financiamento. Lazer completo: piscina climatizada adulto e infantil, raia semiolímpica 25m, espaço fitness, spa com sauna, playground, pet place, salão de festas, salão de jogos com boliche, salão gourmet. Chaves na imobiliária. Rua Cornélio Procópio, 202 - Boqueirão, Praia Grande/SP."

3. **VALORES**: Números puros em BRL (sem R$, sem pontos de milhar). Ex: 450000, não "R$ 450.000,00".

4. **CAMPOS AUSENTES**: Se algum campo não estiver disponível, omita-o. Mas NUNCA omita a description.

5. **FOTOS**: Se houver link de fotos/pasta do imóvel, inclua em "photos_url". Se houver um link geral compartilhado, repita para cada imóvel.

Extraia ABSOLUTAMENTE TODOS os imóveis/unidades do documento. Não pule nenhum.`;

function normalizeExtractedProperties(rawProperties: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rawProperties)) return [];

  return rawProperties.map((item) => {
    if (!item || typeof item !== "object") return {};

    const property = { ...(item as Record<string, unknown>) };

    // Normalize photo URL aliases
    const photoLinkAliases = [
      property.photos_url,
      property.photo_url,
      property.photo_urls,
      property.photos_link,
      property.photo_link,
      property.fotos_url,
      property.link_fotos,
      property.url_fotos,
    ];

    const firstValidPhotoLink = photoLinkAliases.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) as string | undefined;

    if (firstValidPhotoLink) {
      property.photos_url = firstValidPhotoLink.trim();
    }

    // If price is missing but we have price_cash or price_financed, use the lowest
    if (!property.price) {
      const priceCash = typeof property.price_cash === "number" ? property.price_cash : 0;
      const priceFinanced = typeof property.price_financed === "number" ? property.price_financed : 0;
      if (priceCash > 0 && priceFinanced > 0) {
        property.price = Math.min(priceCash, priceFinanced);
      } else if (priceCash > 0) {
        property.price = priceCash;
      } else if (priceFinanced > 0) {
        property.price = priceFinanced;
      }
    }

    // Enrich description with payment conditions if not already included
    if (property.description && typeof property.description === "string") {
      const desc = property.description;
      const hasPriceInfo = desc.includes("vista") || desc.includes("financiamento") || desc.includes("Valor");
      if (!hasPriceInfo) {
        const parts: string[] = [];
        if (typeof property.price_cash === "number" && property.price_cash > 0) {
          parts.push(`Valor à vista: R$ ${property.price_cash.toLocaleString("pt-BR")}`);
        }
        if (typeof property.price_financed === "number" && property.price_financed > 0) {
          parts.push(`Financiamento: R$ ${property.price_financed.toLocaleString("pt-BR")}`);
        }
        if (parts.length > 0) {
          property.description = `${desc} ${parts.join(". ")}.`;
        }
      }
    }

    return property;
  });
}

const PAGES_PER_CHUNK = 5;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function extractChunk(
  chunkBytes: Uint8Array,
  chunkLabel: string,
  enrichedPrompt: string,
  authHeader: string,
  supabaseUrl: string,
  jobId: string,
): Promise<Record<string, unknown>[]> {
  const chunkBase64 = toBase64(chunkBytes.buffer as ArrayBuffer);
  console.log(`[extract-pdf] Job ${jobId}: Sending chunk "${chunkLabel}" (${(chunkBytes.length / 1024).toFixed(1)} KB)`);

  const routerResp = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task_type: "pdf_extract",
      prompt: enrichedPrompt,
      image_base64: chunkBase64,
      file_mime_type: "application/pdf",
    }),
  });

  const routerResult = await routerResp.json();
  console.log(`[extract-pdf] Job ${jobId}: chunk "${chunkLabel}" → success=${routerResult?.success} provider=${routerResult?.provider}`);

  if (!routerResult?.success) {
    throw new Error(`AI falhou no chunk "${chunkLabel}": ${routerResult?.error || "unknown"}`);
  }

  const text = routerResult.text || "";
  console.log(`[extract-pdf] Job ${jobId}: chunk "${chunkLabel}" text length=${text.length}`);

  return parseAiJsonResponse(text, jobId, chunkLabel);
}

function parseAiJsonResponse(text: string, jobId: string, label: string): Record<string, unknown>[] {
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.warn(`[extract-pdf] Job ${jobId}: No JSON in chunk "${label}"`);
    return [];
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, (c) => c === "\n" || c === "\t" ? c : "");
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Attempt to repair truncated JSON
      let braces = 0, brackets = 0;
      for (const ch of cleaned) {
        if (ch === "{") braces++;
        else if (ch === "}") braces--;
        else if (ch === "[") brackets++;
        else if (ch === "]") brackets--;
      }
      let repaired = cleaned.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
      repaired = repaired.replace(/,\s*$/, "");
      while (brackets > 0) { repaired += "]"; brackets--; }
      while (braces > 0) { repaired += "}"; braces--; }
      console.warn(`[extract-pdf] Job ${jobId}: repaired truncated JSON in chunk "${label}"`);
      try {
        parsed = JSON.parse(repaired);
      } catch (e) {
        console.error(`[extract-pdf] Job ${jobId}: JSON parse failed for chunk "${label}"`);
        return [];
      }
    }
  }

  const props = parsed?.properties || parsed?.imoveis || [];
  return Array.isArray(props) ? props : [];
}

async function processInBackground(jobId: string, signedUrl: string, fileName: string, authHeader: string, sb: any, supabaseUrl: string) {
  try {
    // Download PDF
    const pdfResp = await fetch(signedUrl);
    if (!pdfResp.ok) throw new Error(`Falha ao baixar PDF: ${pdfResp.status}`);
    const pdfBuffer = await pdfResp.arrayBuffer();

    // Load PDF document
    const sourcePdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const totalPages = sourcePdf.getPageCount();

    // Extract hyperlinks from annotations
    let extractedLinks: { page: number; url: string }[] = [];
    try {
      const allLinks = extractHyperlinksFromPdf(sourcePdf);
      extractedLinks = filterPhotoLinks(allLinks);
      console.log(`[extract-pdf] Job ${jobId}: ${totalPages} pages, ${allLinks.length} hyperlinks, ${extractedLinks.length} photo links`);
    } catch (linkErr) {
      console.warn(`[extract-pdf] Job ${jobId}: Could not extract hyperlinks:`, linkErr);
    }

    // Build enriched prompt with photo links
    let enrichedPrompt = EXTRACT_PROMPT;
    if (extractedLinks.length > 0) {
      const uniqueUrls = [...new Set(extractedLinks.map(l => l.url))];
      if (uniqueUrls.length === 1) {
        enrichedPrompt += `\n\nIMPORTANTE: O PDF contém o seguinte link de fotos compartilhado para os imóveis: ${uniqueUrls[0]}
Use este link como "photos_url" para TODOS os imóveis extraídos.`;
      } else {
        const linksList = extractedLinks.map(l => `- Página ${l.page}: ${l.url}`).join("\n");
        enrichedPrompt += `\n\nIMPORTANTE: O PDF contém os seguintes links de fotos/pastas (extraídos dos hyperlinks do documento):
${linksList}
Associe cada link ao imóvel correspondente da mesma página/contexto no campo "photos_url". Se um link é compartilhado entre múltiplos imóveis, repita-o para cada um.`;
      }
    }

    // Determine if we need to split
    const allProperties: Record<string, unknown>[] = [];

    if (totalPages <= PAGES_PER_CHUNK) {
      // Small PDF — process as a single chunk
      console.log(`[extract-pdf] Job ${jobId}: Small PDF (${totalPages} pages), processing as single chunk`);
      const pdfBytes = await sourcePdf.save({ useObjectStreams: true, addDefaultPage: false });
      const props = await extractChunk(pdfBytes, `all (1-${totalPages})`, enrichedPrompt, authHeader, supabaseUrl, jobId);
      allProperties.push(...props);
    } else {
      // Large PDF — split into chunks
      const numChunks = Math.ceil(totalPages / PAGES_PER_CHUNK);
      console.log(`[extract-pdf] Job ${jobId}: Large PDF (${totalPages} pages), splitting into ${numChunks} chunks of ${PAGES_PER_CHUNK} pages`);

      // Update job progress
      await sb.from("pdf_extract_jobs").update({
        result: { progress: { total_chunks: numChunks, completed: 0, total_pages: totalPages } },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
        const startPage = chunkIdx * PAGES_PER_CHUNK;
        const endPage = Math.min(startPage + PAGES_PER_CHUNK, totalPages);
        const chunkLabel = `pages ${startPage + 1}-${endPage}`;

        try {
          // Create a new PDF with just these pages
          const chunkPdf = await PDFDocument.create();
          const pageIndices = Array.from({ length: endPage - startPage }, (_, i) => startPage + i);
          const copiedPages = await chunkPdf.copyPages(sourcePdf, pageIndices);
          copiedPages.forEach(page => chunkPdf.addPage(page));
          const chunkBytes = await chunkPdf.save({ useObjectStreams: true, addDefaultPage: false });

          // Filter links relevant to this chunk's pages
          let chunkPrompt = enrichedPrompt;
          const chunkLinks = extractedLinks.filter(l => l.page >= startPage + 1 && l.page <= endPage);
          if (chunkLinks.length > 0 && extractedLinks.length > 1) {
            const linksList = chunkLinks.map(l => `- Página ${l.page}: ${l.url}`).join("\n");
            chunkPrompt = EXTRACT_PROMPT + `\n\nIMPORTANTE: Links de fotos relevantes para estas páginas:\n${linksList}\nAssocie cada link ao imóvel correspondente no campo "photos_url".`;
          }

          const props = await extractChunk(chunkBytes, chunkLabel, chunkPrompt, authHeader, supabaseUrl, jobId);
          allProperties.push(...props);

          console.log(`[extract-pdf] Job ${jobId}: chunk ${chunkIdx + 1}/${numChunks} → ${props.length} properties`);

          // Update progress
          await sb.from("pdf_extract_jobs").update({
            result: { progress: { total_chunks: numChunks, completed: chunkIdx + 1, total_pages: totalPages, properties_so_far: allProperties.length } },
            updated_at: new Date().toISOString(),
          }).eq("id", jobId);
        } catch (chunkErr) {
          console.error(`[extract-pdf] Job ${jobId}: chunk "${chunkLabel}" failed:`, chunkErr);
          // Continue with other chunks — partial results are better than nothing
        }
      }
    }

    // Normalize and deduplicate
    const normalized = normalizeExtractedProperties(allProperties);

    // Deduplicate by unit+title (same property may appear across chunk boundaries)
    const seen = new Set<string>();
    const deduped = normalized.filter((p: any) => {
      const key = `${(p.title || "").toLowerCase().trim()}|${(p.unit || "").toLowerCase().trim()}|${p.price || 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const parsed = { properties: deduped };

    // Fallback: apply photo links to properties without photos_url
    if (extractedLinks.length > 0) {
      const propertiesWithoutPhotos = parsed.properties.filter((p: any) => !p.photos_url);
      if (propertiesWithoutPhotos.length > 0) {
        const uniqueUrls = [...new Set(extractedLinks.map(l => l.url))];
        if (uniqueUrls.length === 1) {
          for (const prop of parsed.properties) {
            if (!prop.photos_url) prop.photos_url = uniqueUrls[0];
          }
        } else if (uniqueUrls.length >= parsed.properties.length * 0.5) {
          let linkIdx = 0;
          for (const prop of parsed.properties) {
            if (!prop.photos_url && linkIdx < uniqueUrls.length) {
              prop.photos_url = uniqueUrls[linkIdx];
              linkIdx++;
            }
          }
        } else {
          const urlCounts = new Map<string, number>();
          for (const l of extractedLinks) urlCounts.set(l.url, (urlCounts.get(l.url) || 0) + 1);
          const mostCommon = [...urlCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          if (mostCommon) {
            for (const prop of parsed.properties) {
              if (!prop.photos_url) prop.photos_url = mostCommon;
            }
          }
        }
      }
    }

    await sb.from("pdf_extract_jobs").update({
      status: "complete",
      result: parsed,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`[extract-pdf] Job ${jobId}: completo, ${parsed.properties.length} imóveis extraídos (${totalPages} pages, deduped from ${allProperties.length})`);
  } catch (err) {
    console.error(`[extract-pdf] Job ${jobId} falhou:`, err);
    await sb.from("pdf_extract_jobs").update({
      status: "failed",
      error: err instanceof Error ? err.message : "Erro desconhecido",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const jobId = url.searchParams.get("job_id");
      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: job } = await anonClient
        .from("pdf_extract_jobs")
        .select("status, result, error")
        .eq("id", jobId)
        .single();

      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status === "complete") {
        return new Response(JSON.stringify({ success: true, status: "complete", data: job.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status === "failed") {
        return new Response(JSON.stringify({
          success: false,
          status: "failed",
          error: job.error || "Falha na extração",
          fallback: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await sb
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let storageUrl: string;
    let fileName: string;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      storageUrl = body.storage_url;
      fileName = body.file_name || "document.pdf";
      if (!storageUrl) throw new Error("storage_url é obrigatório");
      if (!isAllowedUrl(storageUrl)) throw new Error("URL não permitida.");
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Nenhum arquivo enviado");
      if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo > 50MB");

      fileName = file.name;
      const tempPath = `pdf-extract/${userId}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await sb.storage
        .from("temp-uploads")
        .upload(tempPath, await file.arrayBuffer(), { contentType: "application/pdf" });

      if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

      const { data: signedData } = await sb.storage.from("temp-uploads").createSignedUrl(tempPath, 3600);
      if (!signedData?.signedUrl) throw new Error("Falha ao gerar URL assinada");

      storageUrl = signedData.signedUrl;
    } else {
      throw new Error("Content-Type não suportado");
    }

    const { data: job, error: jobError } = await sb
      .from("pdf_extract_jobs")
      .insert({
        organization_id: profile.organization_id,
        user_id: userId,
        status: "processing",
        file_name: fileName,
      })
      .select("id")
      .single();

    if (jobError || !job) throw new Error("Falha ao criar job");

    // Processa em background via AI Router (Gemini → Claude fallback)
    EdgeRuntime.waitUntil(
      processInBackground(job.id, storageUrl, fileName, authHeader, sb, supabaseUrl),
    );

    return new Response(JSON.stringify({ job_id: job.id, status: "processing" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-pdf] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
