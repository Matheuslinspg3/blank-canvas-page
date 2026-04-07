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
  Shield, Wifi, FileCheck, Cloud, Copy, Server
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { extractColorsFromImage } from "@/lib/extractColors";
import { DomainSetupWizard } from "./DomainSetupWizard";

// ─── Website Settings Section ────────────────────────────────────────────────

function WebsiteContentSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["website-settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_settings")
        .select("*")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    hero_title: "",
    hero_subtitle: "",
    about_text: "",
    contact_email: "",
    contact_phone: "",
    whatsapp_number: "",
    whatsapp_message: "",
    show_whatsapp_float: true,
    meta_title: "",
    meta_description: "",
    is_active: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        hero_title: settings.hero_title || "",
        hero_subtitle: settings.hero_subtitle || "",
        about_text: settings.about_text || "",
        contact_email: settings.contact_email || "",
        contact_phone: settings.contact_phone || "",
        whatsapp_number: settings.whatsapp_number || "",
        whatsapp_message: settings.whatsapp_message || "",
        show_whatsapp_float: settings.show_whatsapp_float ?? true,
        meta_title: settings.meta_title || "",
        meta_description: settings.meta_description || "",
        is_active: settings.is_active ?? true,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, organization_id: orgId! };
      if (settings?.id) {
        const { error } = await supabase
          .from("website_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("website_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações do site salvas!");
      queryClient.invalidateQueries({ queryKey: ["website-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Site Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Status do Site
              </CardTitle>
              <CardDescription>Ative ou desative a exibição pública do seu site</CardDescription>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
          </div>
        </CardHeader>
      </Card>

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Seção Principal (Hero)
          </CardTitle>
          <CardDescription>Título e subtítulo exibidos no topo do site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hero_title">Título principal</Label>
            <Input
              id="hero_title"
              placeholder="Encontre o imóvel dos seus sonhos"
              value={form.hero_title}
              onChange={(e) => update("hero_title", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero_subtitle">Subtítulo</Label>
            <Input
              id="hero_subtitle"
              placeholder="Os melhores imóveis da região com atendimento personalizado"
              value={form.hero_subtitle}
              onChange={(e) => update("hero_subtitle", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sobre a Imobiliária
          </CardTitle>
          <CardDescription>Texto exibido na seção "Sobre" do site</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Conte um pouco sobre a sua imobiliária, experiência e diferenciais..."
            value={form.about_text}
            onChange={(e) => update("about_text", e.target.value)}
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contato
          </CardTitle>
          <CardDescription>Informações de contato exibidas no site</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact_email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="contact_email"
                className="pl-9"
                placeholder="contato@imobiliaria.com.br"
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="contact_phone"
                className="pl-9"
                placeholder="(84) 99999-9999"
                value={form.contact_phone}
                onChange={(e) => update("contact_phone", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp
          </CardTitle>
          <CardDescription>Botão flutuante de WhatsApp no site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Mostrar botão flutuante</Label>
            <Switch
              checked={form.show_whatsapp_float}
              onCheckedChange={(v) => update("show_whatsapp_float", v)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">Número do WhatsApp</Label>
              <Input
                id="whatsapp_number"
                placeholder="5584999999999"
                value={form.whatsapp_number}
                onChange={(e) => update("whatsapp_number", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Formato: código do país + DDD + número (sem espaços)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp_message">Mensagem padrão</Label>
              <Input
                id="whatsapp_message"
                placeholder="Olá! Vi o site e gostaria de mais informações."
                value={form.whatsapp_message}
                onChange={(e) => update("whatsapp_message", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            SEO (Google)
          </CardTitle>
          <CardDescription>Otimize como seu site aparece no Google</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta_title">Título da página (meta title)</Label>
            <Input
              id="meta_title"
              placeholder="Porto Caiçara Imóveis — Casas e Apartamentos em Natal"
              value={form.meta_title}
              onChange={(e) => update("meta_title", e.target.value)}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">{form.meta_title.length}/60 caracteres</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta_description">Descrição (meta description)</Label>
            <Textarea
              id="meta_description"
              placeholder="Encontre os melhores imóveis da região com a Porto Caiçara..."
              value={form.meta_description}
              onChange={(e) => update("meta_description", e.target.value)}
              maxLength={160}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">{form.meta_description.length}/160 caracteres</p>
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-2">Pré-visualização no Google:</p>
            <div className="space-y-0.5">
              <p className="text-sm text-primary font-medium truncate">{form.meta_title || "Título do site"}</p>
              <p className="text-xs text-muted-foreground truncate">www.seusite.com.br</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{form.meta_description || "Descrição do site..."}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

// ─── Domain Management Section ───────────────────────────────────────────────

function statusBadge(ssl: string, verification: string, isActive: boolean) {
  if (isActive) return <Badge className="bg-primary text-primary-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Ativo</Badge>;
  if (verification === "pending" || ssl === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{verification}</Badge>;
}

function DomainSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugValue, setSlugValue] = useState("");
  const orgId = profile?.organization_id;

  const { data: orgSlug } = useQuery({
    queryKey: ["org-slug", orgId],
    enabled: !!orgId,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("slug").eq("id", orgId!).single();
      return data?.slug ?? null;
    },
  });

  const { data: wsSettings, isLoading: wsLoading } = useQuery({
    queryKey: ["website-settings-domain", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_settings")
        .select("id, redirect_to_custom_domain, use_custom_domain_url")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const slugMutation = useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "update_slug", slug },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Slug atualizado!");
      setEditingSlug(false);
      queryClient.invalidateQueries({ queryKey: ["org-slug"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar slug"),
  });

  const { data: domains, isLoading } = useQuery({
    queryKey: ["tenant-domains", orgId],
    enabled: !!orgId,
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      const hasPending = data?.some((d) => !d.is_active);
      return hasPending ? 15_000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_domains")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const hasActiveDomain = domains?.some((d: any) => d.is_active) ?? false;

  const toggleMutation = useMutation({
    mutationFn: async (payload: { redirect_to_custom_domain?: boolean; use_custom_domain_url?: boolean }) => {
      if (!wsSettings?.id) throw new Error("Configurações não encontradas");
      const { error } = await supabase
        .from("website_settings")
        .update(payload)
        .eq("id", wsSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva!");
      queryClient.invalidateQueries({ queryKey: ["website-settings-domain"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async (hostname: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "create", hostname },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Domínio cadastrado!", {
        description: data.instructions || "Configure o CNAME e aguarde a verificação.",
      });
      setNewHostname("");
      queryClient.invalidateQueries({ queryKey: ["tenant-domains"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao cadastrar domínio"),
  });

  const checkMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "check_status", domain_id: domainId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-domains"] });
      if (data.is_active) {
        toast.success("Domínio ativo! SSL configurado. 🎉");
      } else {
        toast.info(`SSL: ${data.ssl_status} | Verificação: ${data.verification_status}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "delete", domain_id: domainId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Domínio removido");
      queryClient.invalidateQueries({ queryKey: ["tenant-domains"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const h = newHostname.trim().toLowerCase();
    if (!h || !h.includes(".")) {
      toast.error("Digite um domínio válido (ex: www.meusite.com.br)");
      return;
    }
    createMutation.mutate(h);
  };

  const activeDomain = domains?.find((d: any) => d.is_active);

  return (
    <div className="space-y-6">
      {/* Current site URL with slug editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">URL Padrão do Site</CardTitle>
          <CardDescription>Este é o endereço gratuito do seu site. Você pode personalizar o slug.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!editingSlug ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md truncate">
                {orgSlug ? `https://${orgSlug}.portadocorretor.com.br` : "Carregando..."}
              </code>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => { setSlugValue(orgSlug || ""); setEditingSlug(true); }}>
                <Save className="h-3.5 w-3.5" />
                Editar
              </Button>
              {orgSlug && (
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                  <a href={`https://${orgSlug}.portadocorretor.com.br`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">https://</span>
                <Input
                  value={slugValue}
                  onChange={(e) => setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="flex-1"
                  placeholder="meu-site"
                />
                <span className="text-sm text-muted-foreground">.portadocorretor.com.br</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => slugMutation.mutate(slugValue)} disabled={slugMutation.isPending || !slugValue || slugValue.length < 3}>
                  {slugMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingSlug(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* URL Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" />
            Preferências de URL
          </CardTitle>
          <CardDescription>Configure como os visitantes acessam seu site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Redirect toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Redirecionar para domínio próprio</Label>
              <p className="text-xs text-muted-foreground">
                Visitantes que acessarem pelo subdomínio padrão ({orgSlug}.portadocorretor.com.br) serão redirecionados automaticamente para o domínio próprio.
              </p>
              {!hasActiveDomain && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  Requer um domínio próprio ativo
                </p>
              )}
            </div>
            <Switch
              checked={wsSettings?.redirect_to_custom_domain ?? false}
              disabled={!hasActiveDomain || toggleMutation.isPending}
              onCheckedChange={(v) => toggleMutation.mutate({ redirect_to_custom_domain: v })}
            />
          </div>

          <div className="border-t" />

          {/* Use custom domain for URLs */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Usar domínio próprio nas URLs</Label>
              <p className="text-xs text-muted-foreground">
                URLs públicas de imóveis e links compartilhados usarão o domínio próprio
                {activeDomain ? ` (${activeDomain.hostname})` : ""} ao invés do subdomínio padrão.
              </p>
              {!hasActiveDomain && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  Requer um domínio próprio ativo
                </p>
              )}
            </div>
            <Switch
              checked={wsSettings?.use_custom_domain_url ?? false}
              disabled={!hasActiveDomain || toggleMutation.isPending}
              onCheckedChange={(v) => toggleMutation.mutate({ use_custom_domain_url: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Add domain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domínio Próprio
          </CardTitle>
          <CardDescription>
            Conecte seu domínio próprio (ex: www.portocaicara.com.br) ao site da imobiliária. O SSL é emitido automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              placeholder="www.meusite.com.br"
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </form>

          {/* Domain list with progress stepper */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !domains?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum domínio customizado cadastrado.</p>
          ) : (
            <div className="space-y-4">
              {domains.map((d: any) => {
                const steps = [
                  {
                    label: "CNAME configurado",
                    icon: Wifi,
                    done: d.verification_status === "active",
                    active: d.verification_status === "pending",
                    detail: d.verification_status === "pending" ? "Aguardando CNAME" : d.verification_status === "active" ? "DNS verificado ✓" : d.verification_status,
                  },
                  {
                    label: "Verificação",
                    icon: FileCheck,
                    done: d.verification_status === "active",
                    active: d.verification_status !== "pending" && d.verification_status !== "active",
                    detail: d.verification_status === "active" ? "Verificado ✓" : "Aguardando DNS",
                  },
                  {
                    label: "SSL / HTTPS",
                    icon: Shield,
                    done: d.ssl_status === "active",
                    active: d.verification_status === "active" && d.ssl_status !== "active",
                    detail: d.ssl_status === "active" ? "Certificado ativo ✓" : d.ssl_status === "initializing" ? "Inicializando..." : `SSL: ${d.ssl_status}`,
                  },
                  {
                    label: "Ativo",
                    icon: CheckCircle2,
                    done: d.is_active,
                    active: false,
                    detail: d.is_active ? "Site no ar! 🎉" : "Aguardando",
                  },
                ];
                const doneCount = steps.filter((s) => s.done).length;
                const progress = Math.round((doneCount / steps.length) * 100);

                return (
                  <div key={d.id} className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{d.hostname}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.is_active ? "Domínio ativo" : "Configuração em andamento..."}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => checkMutation.mutate(d.id)} disabled={checkMutation.isPending} title="Verificar agora">
                          <RefreshCw className={`h-4 w-4 ${checkMutation.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover este domínio?")) deleteMutation.mutate(d.id); }} disabled={deleteMutation.isPending} title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {d.is_active ? (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Domínio ativo e funcionando</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground font-medium">{progress}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                              <div
                                key={i}
                                className={`flex items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                                  step.done
                                    ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                                    : step.active
                                    ? "border-primary/30 bg-primary/5 animate-pulse"
                                    : "border-border bg-muted/30"
                                }`}
                              >
                                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${step.done ? "text-green-600" : step.active ? "text-primary" : "text-muted-foreground"}`} />
                                <div className="min-w-0">
                                  <p className={`font-medium ${step.done ? "text-green-700 dark:text-green-400" : ""}`}>{step.label}</p>
                                  <p className="text-muted-foreground truncate">{step.detail}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-refresh note for pending domains */}
          {domains?.some((d: any) => !d.is_active) && (
            <p className="text-xs text-muted-foreground text-center">
              ⏱️ Domínios pendentes atualizam automaticamente a cada 15 segundos
            </p>
          )}
        </CardContent>
      </Card>

      {/* DNS Setup Wizard — only show when there are pending domains */}
      {domains?.some((d: any) => !d.is_active) && (
        <DomainSetupWizard
          hostname={domains?.find((d: any) => !d.is_active)?.hostname || "www.meusite.com.br"}
        />
      )}
    </div>
  );
}

// ─── Brand Section ───────────────────────────────────────────────────────────

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

function LogoField({ label, url, onUpload, onRemove }: { label: string; url: string; onUpload: (f: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="relative inline-block">
          <img src={url} alt={label} className="h-12 max-w-[140px] object-contain rounded border p-1 bg-muted/30" />
          <button type="button" onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">
            <X className="h-2.5 w-2.5" />
          </button>
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
      const ext = file.name.split(".").pop() || "png";
      const path = `${profile.organization_id}/brand/${field}-${Date.now()}.${ext}`;
      const { error: err } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
      if (err) throw err;
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setConfig((prev) => ({ ...prev, [field]: pub.publicUrl }));
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
              onRemove={() => setConfig({ ...config, logo_url: "" })} />
            <LogoField label="Logo (fundo escuro)" url={config.logo_dark_url}
              onUpload={(f) => handleLogoUpload(f, "logo_dark_url")}
              onRemove={() => setConfig({ ...config, logo_dark_url: "" })} />
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
