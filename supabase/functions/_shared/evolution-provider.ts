import { parseJsonSafely, extractQrBase64, extractPairingCode, classifyConnectionStatus, extractPhoneNumber } from "./whatsapp.ts";

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  provider: "evolution_node" | "evolution_go";
}

export interface InstanceResponse {
  ok: boolean;
  status: number;
  data: any;
  raw: string;
}

export class EvolutionProvider {
  private config: EvolutionConfig;

  constructor(config: EvolutionConfig) {
    this.config = config;
    this.config.baseUrl = this.config.baseUrl.replace(/\/$/, "");
  }

  private async request(method: string, path: string, body?: any, instanceId?: string): Promise<InstanceResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (this.config.provider === "evolution_go") {
      // EvoGo (whatsmeow): autenticação por header Instance-Id; token global opcional.
      if (instanceId) headers["Instance-Id"] = instanceId;
      if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    } else {
      headers["apikey"] = this.config.apiKey;
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const raw = await res.text();
      const data = parseJsonSafely(raw);

      return { ok: res.ok, status: res.status, data, raw };
    } catch (e) {
      return {
        ok: false,
        status: 500,
        data: { message: String(e) },
        raw: String(e),
      };
    }
  }

  async createInstance(name: string, token?: string) {
    const tk = token || crypto.randomUUID().replace(/-/g, "");
    if (this.config.provider === "evolution_go") {
      // Evolution Go: tenta múltiplas variantes de payload pois builds diferentes
      // aceitam campos distintos (name/instanceName, qrcode/qrCode, integration opcional)
      const variants: any[] = [
        { name, token: tk, qrcode: true, integration: "WHATSAPP-BAILEYS" },
        { instanceName: name, token: tk, qrcode: true, integration: "WHATSAPP-BAILEYS" },
        { name, token: tk, qrcode: true },
        { instanceName: name, token: tk, qrcode: true },
        { name, token: tk, qrCode: true, integration: "WHATSAPP-BAILEYS" },
      ];
      let last: InstanceResponse | null = null;
      for (const body of variants) {
        const res = await this.request("POST", "/instance/create", body);
        last = res;
        if (res.ok) return res;
        // Se já existe, retorna imediatamente para o caller tratar
        if (/already in use|already exists|in use/i.test(res.raw)) return res;
      }
      console.log(`[EvolutionGo] createInstance failed status=${last?.status} raw=${last?.raw?.slice(0, 500)}`);
      return last!;
    } else {
      // Evolution Node creation
      return await this.request("POST", "/instance/create", {
        name,
        token: tk,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
    }
  }

  async fetchInstances() {
    if (this.config.provider === "evolution_go") {
      return await this.request("GET", "/instance/all");
    } else {
      return await this.request("GET", "/instance/fetchInstances");
    }
  }

  async connectInstance(instanceName: string, phoneNumber?: string) {
    if (this.config.provider === "evolution_go") {
      // Evolution Go connect is POST
      return await this.request("POST", "/instance/connect", {
        name: instanceName,
        number: phoneNumber || undefined,
      });
    } else {
      // Evolution Node connect is GET
      const path = phoneNumber 
        ? `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`
        : `/instance/connect/${instanceName}`;
      return await this.request("GET", path);
    }
  }

  async getQr(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      // Evolution Go: QR é retornado pelo /instance/connect, mas versões/builds
      // diferentes aceitam nomes de campo distintos no payload.
      const attempts = [
        () => this.request("POST", "/instance/connect", { name: instanceName }),
        () => this.request("POST", "/instance/connect", { instanceName }),
        () => this.request("POST", "/instance/connect", { instance: instanceName }),
      ];

      let last: InstanceResponse | null = null;
      for (const attempt of attempts) {
        const res = await attempt();
        last = res;
        if (res.ok && (extractQrBase64(res.data) || extractPairingCode(res.data) || classifyConnectionStatus(res.raw, res.data?.state, res.data?.status, res.data?.instance?.state) === "connected")) {
          return res;
        }
      }
      return last!;
    } else {
      return await this.request("GET", `/instance/connect/${instanceName}`);
    }
  }

  async pair(instanceName: string, phoneNumber: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("POST", "/instance/pair", {
        name: instanceName,
        number: phoneNumber,
      });
    } else {
      return await this.request("GET", `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`);
    }
  }

  async getStatus(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      // In Go, status is GET /instance/status?name=... or GET /instance/status/:name
      return await this.request("GET", `/instance/status?name=${instanceName}`);
    } else {
      return await this.request("GET", `/instance/connectionState/${instanceName}`);
    }
  }


  async logout(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      const attempts = [
        () => this.request("POST", "/instance/logout", { name: instanceName }),
        () => this.request("POST", "/instance/logout", { instanceName }),
        () => this.request("DELETE", `/instance/logout?name=${encodeURIComponent(instanceName)}`),
      ];

      let last: InstanceResponse | null = null;
      for (const attempt of attempts) {
        const res = await attempt();
        last = res;
        if (res.ok || res.status === 404) return res;
      }
      return last!;
    } else {
      return await this.request("DELETE", `/instance/logout/${instanceName}`);
    }
  }

  async delete(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      const attempts = [
        () => this.request("DELETE", `/instance/delete?name=${encodeURIComponent(instanceName)}`),
        () => this.request("DELETE", "/instance/delete", { name: instanceName }),
        () => this.request("DELETE", "/instance/delete", { instanceName }),
      ];

      let last: InstanceResponse | null = null;
      for (const attempt of attempts) {
        const res = await attempt();
        last = res;
        if (res.ok || res.status === 404) return res;
      }
      return last!;
    } else {
      return await this.request("DELETE", `/instance/delete/${instanceName}`);
    }
  }


  async setWebhook(instanceName: string, url: string, secret: string) {
    if (this.config.provider === "evolution_go") {
      // Evolution Go webhook set
      // Based on common patterns in Evolution Go: POST /webhook/set
      return await this.request("POST", "/webhook/set", {
        name: instanceName,
        url,
        enabled: true,
        headers: { "x-webhook-secret": secret },
        events: ["MESSAGES_UPSERT"],
      });
    } else {
      // Evolution Node webhook set
      return await this.request("POST", `/webhook/set/${instanceName}`, {
        url,
        enabled: true,
        byEvents: false,
        base64: true,
        headers: { "x-webhook-secret": secret },
        events: ["MESSAGES_UPSERT"],
      });
    }
  }

  async sendText(instanceName: string, number: string, text: string) {
    // Both usually use /send/text but the payload might differ
    if (this.config.provider === "evolution_go") {
      return await this.request("POST", "/send/text", {
        name: instanceName,
        number,
        text,
      });
    } else {
      return await this.request("POST", `/message/sendText/${instanceName}`, {
        number,
        text,
      });
    }
  }
}
