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
      // Evolution GO: apikey global + instanceId nos endpoints de instância.
      if (this.config.apiKey) headers["apikey"] = this.config.apiKey;
      if (instanceId) headers["instanceId"] = instanceId;
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
      // EvoGo: instância nova ainda não existe, então NÃO mandamos Instance-Id no header.
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
        if (/already in use|already exists|in use/i.test(res.raw)) return res;
      }
      console.log(`[EvolutionGo] createInstance failed status=${last?.status} raw=${last?.raw?.slice(0, 500)}`);
      return last!;
    } else {
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
      return await this.request(
        "POST",
        "/instance/connect",
        phoneNumber ? { number: phoneNumber } : {},
        instanceName,
      );
    } else {
      const path = phoneNumber
        ? `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`
        : `/instance/connect/${instanceName}`;
      return await this.request("GET", path);
    }
  }

  async getQr(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      // EvoGo: QR é exposto em GET /instance/qr (Instance-Id no header).
      const res = await this.request("GET", "/instance/qr", undefined, instanceName);
      if (res.ok && (extractQrBase64(res.data) || extractPairingCode(res.data))) {
        return res;
      }
      // Fallback: alguns builds só geram QR após chamar /instance/connect primeiro.
      const _connect = await this.request("POST", "/instance/connect", {}, instanceName);
      void _connect;
      return await this.request("GET", "/instance/qr", undefined, instanceName);
    } else {
      return await this.request("GET", `/instance/connect/${instanceName}`);
    }
  }

  async pair(instanceName: string, phoneNumber: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("POST", "/instance/pair", { number: phoneNumber }, instanceName);
    } else {
      return await this.request("GET", `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`);
    }
  }

  async getStatus(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("GET", "/instance/status", undefined, instanceName);
    } else {
      return await this.request("GET", `/instance/connectionState/${instanceName}`);
    }
  }


  async logout(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("DELETE", "/instance/logout", undefined, instanceName);
    } else {
      return await this.request("DELETE", `/instance/logout/${instanceName}`);
    }
  }

  async delete(instanceName: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("DELETE", `/instance/delete/${encodeURIComponent(instanceName)}`, undefined, instanceName);
    } else {
      return await this.request("DELETE", `/instance/delete/${instanceName}`);
    }
  }


  async setWebhook(instanceName: string, url: string, secret: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("POST", "/webhook/set", {
        url,
        enabled: true,
        headers: { "x-webhook-secret": secret },
        events: ["MESSAGES_UPSERT"],
      }, instanceName);
    } else {
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
    if (this.config.provider === "evolution_go") {
      return await this.request("POST", "/send/text", { number, text }, instanceName);
    } else {
      return await this.request("POST", `/message/sendText/${instanceName}`, { number, text });
    }
  }

  async sendMedia(
    instanceName: string,
    payload: { number: string; url: string; type?: "image" | "video" | "document" | "audio"; caption?: string; filename?: string; delay?: number },
  ) {
    if (this.config.provider === "evolution_go") {
      const body: any = { number: payload.number, url: payload.url, type: payload.type ?? "image" };
      if (payload.caption !== undefined) body.caption = payload.caption;
      if (payload.filename) body.filename = payload.filename;
      if (payload.delay !== undefined) body.delay = payload.delay;
      return await this.request("POST", "/send/media", body, instanceName);
    } else {
      return await this.request("POST", `/message/sendMedia/${instanceName}`, {
        number: payload.number,
        mediatype: payload.type ?? "image",
        media: payload.url,
        caption: payload.caption ?? "",
        fileName: payload.filename,
      });
    }
  }

  async sendAudio(instanceName: string, number: string, url: string) {
    if (this.config.provider === "evolution_go") {
      return await this.request("POST", "/send/media", { number, url, type: "audio" }, instanceName);
    } else {
      return await this.request("POST", `/message/sendWhatsAppAudio/${instanceName}`, { number, audio: url });
    }
  }
}
