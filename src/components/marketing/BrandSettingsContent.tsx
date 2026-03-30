import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { Palette, Save, Loader2, Upload, Image as ImageIcon, Type, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface BrandConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  slogan: string;
  tagline: string;
  logo_url: string;
  logo_dark_url: string;
  white_label_enabled: boolean;
}

const DEFAULT_BRAND: BrandConfig = {
  primary_color: "#3B82F6",
  secondary_color: "#1E293B",
  accent_color: "#F59E0B",
  font_family: "Montserrat",
  slogan: "",
  tagline: "",
  logo_url: "",
  logo_dark_url: "",
  white_label_enabled: false,
};

const FONT_OPTIONS = [
  { value: "Montserrat", label: "Montserrat" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Poppins", label: "Poppins" },
  { value: "Raleway", label: "Raleway" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Oswald", label: "Oswald" },
];

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded-md border border-border cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-sm" maxLength={7} />
      </div>
    </div>
  );
}

function LogoUploader({ label, url, onUpload, onRemove }: { label: string; url: string; onUpload: (file: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {url ? (
        <div className="relative inline-block">
          <img src={url} alt={label} className="h-20 max-w-[200px] object-contain rounded-md border p-2 bg-muted/30" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => ref.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Logo
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
      />
    </div>
  );
}

export default function BrandSettingsContent() {
  const { user, profile } = useAuth();
  const { planAllowsWhiteLabel } = useWhiteLabel();
  const [config, setConfig] = useState<BrandConfig>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadBrand(); }, [profile?.organization_id]);

  const loadBrand = async () => {
    if (!profile?.organization_id) return;
    try {
      const { data } = await supabase
        .from("brand_settings")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .single();
      if (data) {
        setConfig({
          primary_color: (data as any).primary_color || DEFAULT_BRAND.primary_color,
          secondary_color: (data as any).secondary_color || DEFAULT_BRAND.secondary_color,
          accent_color: (data as any).accent_color || DEFAULT_BRAND.accent_color,
          font_family: (data as any).font_family || DEFAULT_BRAND.font_family,
          slogan: (data as any).slogan || "",
          tagline: (data as any).tagline || "",
          logo_url: (data as any).logo_url || "",
          logo_dark_url: (data as any).logo_dark_url || "",
          white_label_enabled: (data as any).white_label_enabled ?? false,
        });
      }
    } catch { /* first time, use defaults */ }
    setLoading(false);
  };

  const handleLogoUpload = async (file: File, field: "logo_url" | "logo_dark_url") => {
    if (!profile?.organization_id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${profile.organization_id}/brand/${field}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setConfig((prev) => ({ ...prev, [field]: publicUrl.publicUrl }));
      toast.success("Logo carregada!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toastError("Erro ao enviar logo. Verifique se o bucket 'brand-assets' existe.", undefined, { module: "BrandSettingsContent" });
    } finally {
      setUploading(false);
    }
  };

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
      toast.success("Identidade visual salva!");
    } catch (err: any) {
      console.error("Save error:", err);
      toastError("Erro ao salvar configurações.", undefined, { module: "BrandSettingsContent" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cores da Marca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorPicker label="Cor Primária" value={config.primary_color} onChange={(v) => setConfig({ ...config, primary_color: v })} />
            <ColorPicker label="Cor Secundária" value={config.secondary_color} onChange={(v) => setConfig({ ...config, secondary_color: v })} />
            <ColorPicker label="Cor de Destaque" value={config.accent_color} onChange={(v) => setConfig({ ...config, accent_color: v })} />
          </div>
          {/* Preview */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Pré-visualização</Label>
            <div className="flex gap-2 items-center">
              <div className="h-12 w-12 rounded-md shadow-sm" style={{ backgroundColor: config.primary_color }} />
              <div className="h-12 w-12 rounded-md shadow-sm" style={{ backgroundColor: config.secondary_color }} />
              <div className="h-12 w-12 rounded-md shadow-sm" style={{ backgroundColor: config.accent_color }} />
              <div
                className="flex-1 h-12 rounded-md border flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: config.primary_color, color: "#fff", fontFamily: config.font_family }}
              >
                {config.slogan || "Sua Imobiliária"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            Tipografia & Textos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Fonte principal</Label>
            <Select value={config.font_family} onValueChange={(v) => setConfig({ ...config, font_family: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Slogan</Label>
              <Input
                placeholder="Ex: Realizando sonhos imobiliários"
                value={config.slogan}
                onChange={(e) => setConfig({ ...config, slogan: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tagline (opcional)</Label>
              <Input
                placeholder="Ex: Desde 2005"
                value={config.tagline}
                onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Logotipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <LogoUploader
              label="Logo (fundo claro)"
              url={config.logo_url}
              onUpload={(f) => handleLogoUpload(f, "logo_url")}
              onRemove={() => setConfig({ ...config, logo_url: "" })}
            />
            <LogoUploader
              label="Logo (fundo escuro) — opcional"
              url={config.logo_dark_url}
              onUpload={(f) => handleLogoUpload(f, "logo_dark_url")}
              onRemove={() => setConfig({ ...config, logo_dark_url: "" })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A logo será usada automaticamente nas artes e anúncios gerados por IA.
          </p>
        </CardContent>
      </Card>

      {/* White-Label */}
      <Card className={!planAllowsWhiteLabel ? "opacity-60" : "border-primary/30 bg-primary/5"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Tema White-Label
          </CardTitle>
          <CardDescription>
            {planAllowsWhiteLabel
              ? "Ative para substituir a marca 'Porta do Corretor' pela sua em toda a plataforma."
              : "Disponível nos planos Business e Enterprise. Faça upgrade para personalizar toda a plataforma com sua marca."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Ativar White-Label</Label>
              <p className="text-xs text-muted-foreground">
                Substitui logos, cores e remove referências ao Porta do Corretor
              </p>
            </div>
            <Switch
              checked={config.white_label_enabled}
              onCheckedChange={(v) => setConfig({ ...config, white_label_enabled: v })}
              disabled={!planAllowsWhiteLabel}
            />
          </div>
          {config.white_label_enabled && planAllowsWhiteLabel && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/80">
                As cores, logos e fontes configuradas acima serão aplicadas em toda a plataforma.
                O nome "Porta do Corretor" será substituído pelo nome da sua organização.
              </p>
            </div>
          )}
          {!planAllowsWhiteLabel && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="/planos">
                <Crown className="h-4 w-4" />
                Fazer upgrade
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || uploading} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Identidade Visual
        </Button>
      </div>
    </div>
  );
}
