import { corsHeaders } from "../_shared/cors.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface ProviderMatch {
  id: string;
  name: string;
  panel_url: string | null;
  panel_instructions: string;
}

const NS_PATTERNS: { pattern: RegExp; provider: ProviderMatch }[] = [
  {
    pattern: /quickfast/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "QuickFast",
      panel_url: null,
      panel_instructions: "Acesse o cPanel fornecido pela QuickFast (geralmente seudominio.com.br/cpanel ou pelo painel do cliente QuickFast)",
    },
  },
  {
    pattern: /hostgator/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "HostGator",
      panel_url: "https://financeiro.hostgator.com.br",
      panel_instructions: "Acesse o Portal do Cliente HostGator → cPanel → Zone Editor",
    },
  },
  {
    pattern: /locaweb/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "Locaweb",
      panel_url: "https://painelv3.locaweb.com.br",
      panel_instructions: "Acesse o Painel Locaweb → Hospedagem → Zona DNS",
    },
  },
  {
    pattern: /umbler/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "Umbler",
      panel_url: "https://app.umbler.com",
      panel_instructions: "Acesse o painel Umbler → Domínios → Zona DNS",
    },
  },
  {
    pattern: /kinghost/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "KingHost",
      panel_url: "https://painel.kinghost.com.br",
      panel_instructions: "Acesse o Painel KingHost → Domínios → Editar DNS",
    },
  },
  {
    pattern: /cloudflare/i,
    provider: {
      id: "cloudflare",
      name: "Cloudflare",
      panel_url: "https://dash.cloudflare.com",
      panel_instructions: "Acesse dash.cloudflare.com → selecione seu domínio → DNS → Records",
    },
  },
  {
    pattern: /godaddy|domaincontrol/i,
    provider: {
      id: "godaddy",
      name: "GoDaddy",
      panel_url: "https://dcc.godaddy.com/dns",
      panel_instructions: "Acesse dcc.godaddy.com → Gerenciar DNS do seu domínio",
    },
  },
  {
    pattern: /hostinger/i,
    provider: {
      id: "hostinger",
      name: "Hostinger",
      panel_url: "https://hpanel.hostinger.com",
      panel_instructions: "Acesse hpanel.hostinger.com → Domínios → DNS / Nameservers",
    },
  },
  {
    pattern: /registro\.br|dns\.br/i,
    provider: {
      id: "registro-br-dns",
      name: "Registro.br",
      panel_url: "https://registro.br",
      panel_instructions: "Acesse registro.br → seu domínio → DNS → Editar zona",
    },
  },
  {
    pattern: /google|googledomains/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "Google Domains / Squarespace",
      panel_url: "https://domains.squarespace.com",
      panel_instructions: "Acesse domains.squarespace.com → DNS → Registros personalizados",
    },
  },
  {
    pattern: /namecheap/i,
    provider: {
      id: "hospedagem-cpanel",
      name: "Namecheap",
      panel_url: "https://ap.www.namecheap.com",
      panel_instructions: "Acesse Namecheap → Domain List → Manage → Advanced DNS",
    },
  },
];

async function resolveNameservers(domain: string): Promise<string[]> {
  // Use Google's DNS-over-HTTPS to query NS records
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error("DNS lookup failed:", res.status, text);
    return [];
  }
  const data = await res.json();
  if (!data.Answer) return [];
  return data.Answer
    .filter((a: any) => a.type === 2) // NS records
    .map((a: any) => (a.data as string).toLowerCase().replace(/\.$/, ""));
}

function detectProvider(nameservers: string[]): ProviderMatch | null {
  for (const ns of nameservers) {
    for (const { pattern, provider } of NS_PATTERNS) {
      if (pattern.test(ns)) {
        return provider;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400, headers: jsonHeaders });
    }

    const hostname = ((body.hostname as string) || "").toLowerCase().trim();
    if (!hostname || !hostname.includes(".")) {
      return new Response(JSON.stringify({ error: "Domínio inválido" }), { status: 400, headers: jsonHeaders });
    }

    // Extract root domain (e.g., www.example.com.br → example.com.br)
    const parts = hostname.split(".");
    let rootDomain = hostname;
    if (parts.length > 2) {
      // Handle .com.br, .org.br, etc.
      const lastTwo = parts.slice(-2).join(".");
      if (["com.br", "org.br", "net.br", "edu.br", "gov.br", "co.uk", "com.au"].includes(lastTwo)) {
        rootDomain = parts.slice(-3).join(".");
      } else {
        rootDomain = parts.slice(-2).join(".");
      }
    }

    console.log(`Detecting DNS provider for: ${hostname} (root: ${rootDomain})`);

    const nameservers = await resolveNameservers(rootDomain);
    console.log(`Nameservers for ${rootDomain}:`, nameservers);

    const provider = detectProvider(nameservers);

    return new Response(
      JSON.stringify({
        hostname,
        root_domain: rootDomain,
        nameservers,
        provider: provider
          ? {
              id: provider.id,
              name: provider.name,
              panel_url: provider.panel_url,
              panel_instructions: provider.panel_instructions,
            }
          : null,
        detected: !!provider,
      }),
      { headers: jsonHeaders }
    );
  } catch (err) {
    console.error("detect-dns-provider error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: jsonHeaders });
  }
});
