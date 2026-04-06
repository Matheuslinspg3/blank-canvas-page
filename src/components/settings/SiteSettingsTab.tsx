import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Globe, Layout, Phone, Search, Trash2, RefreshCw, Plus,
  CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink, Save,
  MessageSquare, Mail, FileText
} from "lucide-react";
import { toast } from "sonner";

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
              <p className="text-sm text-blue-600 font-medium truncate">{form.meta_title || "Título do site"}</p>
              <p className="text-xs text-green-700 truncate">www.seusite.com.br</p>
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
  if (isActive) return <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />Ativo</Badge>;
  if (verification === "pending" || ssl === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{verification}</Badge>;
}

function DomainSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");
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

  const { data: domains, isLoading } = useQuery({
    queryKey: ["tenant-domains", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_domains")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
        toast.success("Domínio ativo! SSL configurado.");
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

  const siteUrl = orgSlug ? `${window.location.origin}/site/${orgSlug}` : null;

  return (
    <div className="space-y-6">
      {/* Current site URL */}
      {siteUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">URL Padrão do Site</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md truncate">{siteUrl}</code>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

          {/* Instructions */}
          <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
            <p className="font-medium">Como configurar:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Adicione o domínio acima</li>
              <li>No painel DNS do seu domínio, crie um <strong>CNAME</strong> apontando para <code className="bg-muted px-1 rounded">portocaicaraimoveis.lovable.app</code></li>
              <li>Aguarde a verificação e emissão do SSL (pode levar alguns minutos)</li>
              <li>Clique em "Verificar" para atualizar o status</li>
            </ol>
          </div>

          {/* Domain list */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !domains?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum domínio customizado cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {domains.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{d.hostname}</p>
                      <p className="text-xs text-muted-foreground">SSL: {d.ssl_status} | Verificação: {d.verification_status}</p>
                    </div>
                    {statusBadge(d.ssl_status, d.verification_status, d.is_active)}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => checkMutation.mutate(d.id)} disabled={checkMutation.isPending} title="Verificar status">
                      <RefreshCw className={`h-4 w-4 ${checkMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover este domínio?")) deleteMutation.mutate(d.id); }} disabled={deleteMutation.isPending} title="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SiteSettingsTab() {
  return (
    <div className="max-w-3xl space-y-6">
      <Tabs defaultValue="content">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="content" className="gap-2">
            <Layout className="h-4 w-4" />
            Conteúdo do Site
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-2">
            <Globe className="h-4 w-4" />
            Domínio
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-6">
          <WebsiteContentSection />
        </TabsContent>
        <TabsContent value="domain" className="mt-6">
          <DomainSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
