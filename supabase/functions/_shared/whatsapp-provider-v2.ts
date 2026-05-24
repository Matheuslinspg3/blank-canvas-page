import { parseJsonSafely, extractQrBase64, extractPairingCode, classifyConnectionStatus } from "./whatsapp.ts";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ProviderResponse {
  ok: boolean;
  status: number;
  data: any;
  raw: string;
}

export interface WhatsAppProvider {
  createInstance(name: string): Promise<ProviderResponse>;
  connectInstance(name: string): Promise<ProviderResponse>;
  pairInstance(name: string, phoneNumber: string): Promise<ProviderResponse>;
  getStatus(name: string): Promise<ProviderResponse>;
  logoutInstance(name: string): Promise<ProviderResponse>;
  deleteInstance(name: string): Promise<ProviderResponse>;
  sendText(name: string, number: string, text: string): Promise<ProviderResponse>;
}

export class EvolutionGoProvider implements WhatsAppProvider {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.config.baseUrl = this.config.baseUrl.replace(/\/$/, "");
  }

  private async request(method: string, path: string, body?: any): Promise<ProviderResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: this.config.apiKey,
    };

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const raw = await res.text();
      const data = parseJsonSafely(raw);

      return {
        ok: res.ok,
        status: res.status,
        data,
        raw,
      };
    } catch (e) {
      return {
        ok: false,
        status: 500,
        data: { message: String(e) },
        raw: String(e),
      };
    }
  }

  async createInstance(name: string) {
    // Try multiple payload variants for compatibility
    const token = crypto.randomUUID().replace(/-/g, "");
    const variants = [
      { name, token, qrcode: true, integration: "WHATSAPP-BAILEYS" },
      { instanceName: name, token, qrcode: true, integration: "WHATSAPP-BAILEYS" },
    ];

    let lastRes: ProviderResponse | null = null;
    for (const body of variants) {
      const res = await this.request("POST", "/instance/create", body);
      lastRes = res;
      if (res.ok || /already/i.test(res.raw)) return res;
    }
    return lastRes!;
  }

  async connectInstance(name: string) {
    return await this.request("POST", "/instance/connect", { name });
  }

  async pairInstance(name: string, phoneNumber: string) {
    return await this.request("POST", "/instance/pair", { name, number: phoneNumber });
  }

  async getStatus(name: string) {
    return await this.request("GET", `/instance/status?name=${encodeURIComponent(name)}`);
  }

  async logoutInstance(name: string) {
    return await this.request("POST", "/instance/logout", { name });
  }

  async deleteInstance(name: string) {
    return await this.request("DELETE", `/instance/delete?name=${encodeURIComponent(name)}`);
  }

  async sendText(name: string, number: string, text: string) {
    return await this.request("POST", "/send/text", { name, number, text });
  }
}

export function getWhatsAppProvider(type: string, config: ProviderConfig): WhatsAppProvider {
  if (type === "evolution_go") {
    return new EvolutionGoProvider(config);
  }
  throw new Error(`Unsupported provider type: ${type}`);
}
