import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { Crown, Sparkles, Save, Loader2, Upload, X, Palette, Pipette, Eraser } from "lucide-react";
import { extractColorsFromImage } from "@/lib/extractColors";
import { getTransparentLogoUrl, isCloudinaryUrl } from "@/lib/cloudinary/logoTransparency";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWhiteLabel } from "@/hooks/useWhiteLabel";
import { useQueryClient } from "@tanstack/react-query";

interface WhiteLabelConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string;
  logo_dark_url: string;
  white_label_enabled: boolean;
}

const DEFAULTS: WhiteLabelConfig = {
  primary_color: "#D62828",
  secondary_color: "#1E3A5F",
  accent_color: "#F77F00",
  logo_url: "",
  logo_dark_url: "",
  white_label_enabled: false,
};

function MiniColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border border-border cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs h-8" maxLength={7} />
      </div>
    </div>
  );
}

function LogoField({ label, url, onUpload, onRemove, onRemoveBg, removingBg }: { label: string; url: string; onUpload: (f: File) => void; onRemove: () => void; onRemoveBg?: () => void; removingBg?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="space-y-1.5">
          <div className="relative inline-block">
            <img src={url} alt={label} className="h-12 max-w-[140px] object-contain rounded border p-1 bg-muted/30" />
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

export default function WhiteLabelSettings() {
  const { user, profile } = useAuth();
  const { planAllowsWhiteLabel } = useWhiteLabel();
  const qc = useQueryClient();
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULTS);
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
          .select("primary_color, secondary_color, accent_color, logo_url, logo_dark_url, white_label_enabled")
          .eq("organization_id", profile.organization_id)
          .single();
        if (data) {
          setConfig({
            primary_color: (data as any).primary_color || DEFAULTS.primary_color,
            secondary_color: (data as any).secondary_color || DEFAULTS.secondary_color,
            accent_color: (data as any).accent_color || DEFAULTS.accent_color,
            logo_url: (data as any).logo_url || "",
            logo_dark_url: (data as any).logo_dark_url || "",
            white_label_enabled: (data as any).white_label_enabled ?? false,
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
      toastError("Erro ao enviar logo", e, { module: "WhiteLabelSettings" });
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
      // Auto-apply top 3
      setConfig((prev) => ({
        ...prev,
        primary_color: colors[0] || prev.primary_color,
        secondary_color: colors[1] || prev.secondary_color,
        accent_color: colors[2] || prev.accent_color,
      }));
      toast.success(`${colors.length} cores extraídas da logo!`);
    } catch {
      toast.error("Erro ao extrair cores. A imagem pode estar em outro domínio.");
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
      toast.success("Personalização salva! Recarregue para ver as mudanças.");
    } catch (e: any) {
      toastError("Erro ao salvar", e, { module: "WhiteLabelSettings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className={!planAllowsWhiteLabel ? "opacity-60" : "border-primary/20"}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          Personalização White-Label
        </CardTitle>
        <CardDescription className="text-xs">
          {planAllowsWhiteLabel
            ? "Personalize cores, logos e remova a marca 'Porta do Corretor' da plataforma."
            : "Disponível nos planos Business e Enterprise."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Ativar White-Label</Label>
            <p className="text-xs text-muted-foreground">Substitui logos e cores em toda a plataforma</p>
          </div>
          <Switch
            checked={config.white_label_enabled}
            onCheckedChange={(v) => setConfig({ ...config, white_label_enabled: v })}
            disabled={!planAllowsWhiteLabel}
          />
        </div>

        {config.white_label_enabled && planAllowsWhiteLabel && (
          <>
            {/* Extract from logo */}
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
                          // Click to apply: 1st→primary, 2nd→secondary, 3rd→accent, else cycles
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

            {/* Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniColorPicker label="Cor Primária" value={config.primary_color} onChange={(v) => setConfig({ ...config, primary_color: v })} />
              <MiniColorPicker label="Cor Secundária" value={config.secondary_color} onChange={(v) => setConfig({ ...config, secondary_color: v })} />
              <MiniColorPicker label="Cor de Destaque" value={config.accent_color} onChange={(v) => setConfig({ ...config, accent_color: v })} />
            </div>

            {/* Preview */}
            <div className="flex gap-2 items-center">
              <div className="h-8 w-8 rounded" style={{ backgroundColor: config.primary_color }} />
              <div className="h-8 w-8 rounded" style={{ backgroundColor: config.secondary_color }} />
              <div className="h-8 w-8 rounded" style={{ backgroundColor: config.accent_color }} />
              <span className="text-xs text-muted-foreground ml-2">Pré-visualização</span>
            </div>

            {/* Logos */}
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

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/80">
                As cores e logos serão aplicadas na sidebar, header e em toda a plataforma.
                O nome "Porta do Corretor" será substituído pelo nome da sua organização.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || uploading} size="sm" className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar personalização
              </Button>
            </div>
          </>
        )}

        {!config.white_label_enabled && planAllowsWhiteLabel && (
          <Button onClick={handleSave} disabled={saving} size="sm" variant="outline" className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        )}

        {!planAllowsWhiteLabel && (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href="/planos">
              <Crown className="h-3.5 w-3.5" /> Fazer upgrade
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
