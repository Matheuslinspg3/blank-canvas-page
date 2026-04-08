import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Globe, Layout, Phone, Search, Trash2, RefreshCw, Plus,
  CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink, Save,
  MessageSquare, Mail, FileText, Palette, Upload, X, Pipette, Crown,
  Shield, Wifi, FileCheck, Cloud, Copy, Server, Sparkles, Eraser,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { extractColorsFromImage } from "@/lib/extractColors";
import { getLogoPreviewUrl, getTransparentLogoUrl, isCloudinaryUrl } from "@/lib/cloudinary/logoTransparency";
...
function LogoField({ label, url, onUpload, onRemove, onRemoveBg, removingBg }: { label: string; url: string; onUpload: (f: File) => void; onRemove: () => void; onRemoveBg?: () => void; removingBg?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="space-y-1.5">
          <div className="relative inline-block">
            <img key={url} src={getLogoPreviewUrl(url)} alt={label} className="h-12 max-w-[140px] object-contain rounded border p-1 bg-muted/30" />
            <button type="button" onClick={onRemove}
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
          {onRemoveBg && (
            <Button variant="outline" size="sm" onClick={onRemoveBg} disabled={removingBg} className="gap-1.5 h-7 text-[10px]">
              {removingBg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eraser className="h-3 w-3" />}
              {removingBg ? "Removendo..." : "Remover fundo"}
            </Button>
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => ref.current?.click()} className="gap-1.5 h-8 text-xs">
          <Upload className="h-3 w-3" /> Upload
        </Button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
    </div>
  );
}

function BrandSection() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [config, setConfig] = useState({
    primary_color: "#D62828",
    secondary_color: "#1E3A5F",
    accent_color: "#F77F00",
    logo_url: "",
    logo_dark_url: "",
    font_family: "Montserrat",
    slogan: "",
    tagline: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);

  const handleRemoveBg = (field: "logo_url" | "logo_dark_url") => {
    const url = config[field];
    if (!url) return;
    if (!isCloudinaryUrl(url)) {
      toast.error("Remoção de fundo funciona apenas com imagens do Cloudinary.");
      return;
    }
    const transparentUrl = getTransparentLogoUrl(url);
    setConfig((prev) => ({ ...prev, [field]: transparentUrl }));
    toast.success("Fundo removido! Salve para aplicar.");
  };

  useEffect(() => {
    if (!profile?.organization_id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("brand_settings")
          .select("primary_color, secondary_color, accent_color, logo_url, logo_dark_url, font_family, slogan, tagline")
          .eq("organization_id", profile.organization_id)
          .maybeSingle();
        if (data) {
          setConfig({
            primary_color: data.primary_color || "#D62828",
            secondary_color: data.secondary_color || "#1E3A5F",
            accent_color: data.accent_color || "#F77F00",
            logo_url: data.logo_url || "",
            logo_dark_url: data.logo_dark_url || "",
            font_family: data.font_family || "Montserrat",
            slogan: data.slogan || "",
            tagline: data.tagline || "",
          });
        }
      } catch { /* defaults */ }
      setLoading(false);
    })();
  }, [profile?.organization_id]);

  const handleLogoUpload = async (file: File, field: "logo_url" | "logo_dark_url") => {
    if (!profile?.organization_id) return;
    setUploading(true);
    try {
      const { uploadLogoToCloudinary } = await import("@/lib/cloudinary/uploadLogo");
      const url = await uploadLogoToCloudinary(file, profile.organization_id, field);
      setConfig((prev) => ({ ...prev, [field]: url }));
      toast.success("Logo enviada!");
    } catch (e: any) {
      toastError("Erro ao enviar logo", e, { module: "SiteBrand" });
    } finally {
      setUploading(false);
    }
  };

  const handleExtractColors = useCallback(async () => {
    const url = config.logo_url;
    if (!url) { toast.error("Envie uma logo primeiro"); return; }
    setExtracting(true);
    try {
      const colors = await extractColorsFromImage(url, 6);
      if (colors.length === 0) {
        toast.error("Não foi possível extrair cores desta imagem");
        return;
      }
      setExtractedColors(colors);
      setConfig((prev) => ({
        ...prev,
        primary_color: colors[0] || prev.primary_color,
        secondary_color: colors[1] || prev.secondary_color,
        accent_color: colors[2] || prev.accent_color,
      }));
      toast.success(`${colors.length} cores extraídas da logo!`);
    } catch {
      toast.error("Erro ao extrair cores.");
    } finally {
      setExtracting(false);
    }
  }, [config.logo_url]);

  const handleSave = async () => {
    if (!profile?.organization_id || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("brand_settings").upsert({
        organization_id: profile.organization_id,
        ...config,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      } as any, { onConflict: "organization_id" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["white-label"] });
      qc.invalidateQueries({ queryKey: ["storefront-brand"] });
      toast.success("Marca salva com sucesso!");
    } catch (e: any) {
      toastError("Erro ao salvar", e, { module: "SiteBrand" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Logos
          </CardTitle>
          <CardDescription>Logo principal e versão para fundo escuro do site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LogoField label="Logo principal" url={config.logo_url}
              onUpload={(f) => handleLogoUpload(f, "logo_url")}
              onRemove={() => setConfig({ ...config, logo_url: "" })}
              onRemoveBg={() => handleRemoveBg("logo_url")}
              removingBg={removingBg} />
            <LogoField label="Logo (fundo escuro)" url={config.logo_dark_url}
              onUpload={(f) => handleLogoUpload(f, "logo_dark_url")}
              onRemove={() => setConfig({ ...config, logo_dark_url: "" })}
              onRemoveBg={() => handleRemoveBg("logo_dark_url")}
              removingBg={removingBg} />
          </div>

          {/* Extract colors from logo */}
          {config.logo_url && (
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={handleExtractColors} disabled={extracting} className="gap-2 h-8 text-xs">
                {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pipette className="h-3 w-3" />}
                Extrair cores da logo
              </Button>
              {extractedColors.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-1">Cores detectadas:</span>
                  {extractedColors.map((color, i) => (
                    <button key={i} type="button" title={`Aplicar ${color}`}
                      className="h-7 w-7 rounded-md border border-border hover:ring-2 ring-primary/40 transition-all cursor-pointer"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        const targets = ["primary_color", "secondary_color", "accent_color"] as const;
                        const target = targets[i % 3];
                        setConfig((prev) => ({ ...prev, [target]: color }));
                        toast.success(`Cor aplicada como ${target === "primary_color" ? "primária" : target === "secondary_color" ? "secundária" : "destaque"}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cores da Marca
          </CardTitle>
          <CardDescription>Cores aplicadas no site público e na plataforma (se white-label ativo)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniColorPicker label="Cor Primária" value={config.primary_color} onChange={(v) => setConfig({ ...config, primary_color: v })} />
            <MiniColorPicker label="Cor Secundária" value={config.secondary_color} onChange={(v) => setConfig({ ...config, secondary_color: v })} />
            <MiniColorPicker label="Cor de Destaque" value={config.accent_color} onChange={(v) => setConfig({ ...config, accent_color: v })} />
          </div>
          <div className="flex gap-2 items-center">
            <div className="h-8 w-8 rounded" style={{ backgroundColor: config.primary_color }} />
            <div className="h-8 w-8 rounded" style={{ backgroundColor: config.secondary_color }} />
            <div className="h-8 w-8 rounded" style={{ backgroundColor: config.accent_color }} />
            <span className="text-xs text-muted-foreground ml-2">Pré-visualização</span>
          </div>
        </CardContent>
      </Card>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Identidade
          </CardTitle>
          <CardDescription>Slogan, tagline e tipografia do site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slogan">Slogan</Label>
            <Input id="slogan" placeholder="Realizando sonhos imobiliários" value={config.slogan}
              onChange={(e) => setConfig({ ...config, slogan: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" placeholder="Sua imobiliária de confiança" value={config.tagline}
              onChange={(e) => setConfig({ ...config, tagline: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="font_family">Fonte do site</Label>
            <Input id="font_family" placeholder="Montserrat" value={config.font_family}
              onChange={(e) => setConfig({ ...config, font_family: e.target.value })} />
            <p className="text-xs text-muted-foreground">Nome da fonte do Google Fonts (ex: Montserrat, Inter, Poppins)</p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || uploading} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar marca
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SiteSettingsTab() {
  return (
    <div className="max-w-3xl space-y-6">
      <Tabs defaultValue="content">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content" className="gap-2">
            <Layout className="h-4 w-4" />
            Conteúdo
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-2">
            <Palette className="h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-2">
            <Globe className="h-4 w-4" />
            Domínio
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-6">
          <WebsiteContentSection />
        </TabsContent>
        <TabsContent value="brand" className="mt-6">
          <BrandSection />
        </TabsContent>
        <TabsContent value="domain" className="mt-6">
          <DomainSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
