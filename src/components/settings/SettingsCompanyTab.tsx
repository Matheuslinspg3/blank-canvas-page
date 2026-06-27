import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, Camera, Loader2, Search, ShieldCheck, ShieldAlert, Store, Building, User } from "lucide-react";
import { PropertyReviewSettingsCard } from "./PropertyReviewSettingsCard";
import { BackupSettingsCard } from "./BackupSettingsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type MpDefaultSource = "organization" | "owner";

const BRAZILIAN_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export function SettingsCompanyTab() {
  const { profile, organizationType } = useAuth();
  const { isAdminOrAbove } = useUserRoles();
  const { uploadImage, isUploading: isUploadingAvatar } = useImageUpload();
  const canEditCompany = isAdminOrAbove;
  const queryClient = useQueryClient();

  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyStreet, setCompanyStreet] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [companyComplement, setCompanyComplement] = useState("");
  const [companyNeighborhood, setCompanyNeighborhood] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyZipcode, setCompanyZipcode] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);

  // Marketplace default phone source (per organization)
  const [mpDefaultSource, setMpDefaultSource] = useState<MpDefaultSource>("organization");
  const [mpInitialSource, setMpInitialSource] = useState<MpDefaultSource>("organization");
  const [savingMpDefault, setSavingMpDefault] = useState(false);

  useEffect(() => {
    if (!profile?.organization_id) return;
    supabase.from("organizations")
      .select("name, cnpj, phone, email, logo_url, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zipcode, marketplace_default_contact_phone_source")
      .eq("id", profile.organization_id).maybeSingle().then(({ data }) => {
        if (!data) return;
        setCompanyName(data.name || ""); setCompanyCnpj(data.cnpj || "");
        setCompanyPhone(data.phone || ""); setCompanyEmail(data.email || "");
        setCompanyLogoUrl(data.logo_url || ""); setCompanyStreet(data.address_street || "");
        setCompanyNumber(data.address_number || ""); setCompanyComplement(data.address_complement || "");
        setCompanyNeighborhood(data.address_neighborhood || ""); setCompanyCity(data.address_city || "");
        setCompanyState(data.address_state || ""); setCompanyZipcode(data.address_zipcode || "");
        const raw = (data as any).marketplace_default_contact_phone_source;
        const normalized: MpDefaultSource = raw === "owner" ? "owner" : "organization";
        setMpDefaultSource(normalized);
        setMpInitialSource(normalized);
      });
  }, [profile?.organization_id]);

  const handleSearchCnpj = async () => {
    const cnpjClean = companyCnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) { toastError("CNPJ deve conter 14 dígitos", undefined, { module: "Settings" }); return; }
    setSearchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      if (data.razao_social) setCompanyName(data.razao_social);
      if (data.ddd_telefone_1) setCompanyPhone(data.ddd_telefone_1);
      if (data.email) setCompanyEmail(data.email);
      if (data.cep) setCompanyZipcode(data.cep.replace(/(\d{5})(\d{3})/, "$1-$2"));
      if (data.uf) setCompanyState(data.uf);
      if (data.municipio) setCompanyCity(data.municipio);
      if (data.bairro) setCompanyNeighborhood(data.bairro);
      if (data.logradouro) setCompanyStreet(data.logradouro);
      if (data.numero) setCompanyNumber(data.numero);
      if (data.complemento) setCompanyComplement(data.complemento);
      toast.success("Dados preenchidos automaticamente via CNPJ!");
    } catch (err: any) { toastError("Erro ao buscar CNPJ", err, { module: "Settings" }); }
    finally { setSearchingCnpj(false); }
  };

  const handleSearchCep = async () => {
    const cepClean = companyZipcode.replace(/\D/g, "");
    if (cepClean.length !== 8) return;
    setSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
      const data = await res.json();
      if (data.erro) throw new Error("CEP não encontrado");
      if (data.logradouro) setCompanyStreet(data.logradouro);
      if (data.bairro) setCompanyNeighborhood(data.bairro);
      if (data.localidade) setCompanyCity(data.localidade);
      if (data.uf) setCompanyState(data.uf);
      toast.success("Endereço preenchido via CEP!");
    } catch { toastError("CEP não encontrado", undefined, { module: "Settings" }); }
    finally { setSearchingCep(false); }
  };

  const handleSaveCompany = async () => {
    if (!profile?.organization_id || !canEditCompany) return;
    setSavingCompany(true);
    const { error } = await supabase.from("organizations").update({
      name: companyName, cnpj: companyCnpj, phone: companyPhone, email: companyEmail,
      logo_url: companyLogoUrl || null, address_street: companyStreet || null,
      address_number: companyNumber || null, address_complement: companyComplement || null,
      address_neighborhood: companyNeighborhood || null, address_city: companyCity || null,
      address_state: companyState || null, address_zipcode: companyZipcode || null,
    }).eq("id", profile.organization_id);
    setSavingCompany(false);
    if (error) toastError("Erro ao salvar dados da empresa", undefined, { module: "Settings" });
    else toast.success("Dados da empresa atualizados");
  };

  const handleSaveMpDefault = async () => {
    if (!profile?.organization_id || !canEditCompany) return;
    if (mpDefaultSource === mpInitialSource) return;
    setSavingMpDefault(true);
    const { error } = await supabase
      .from("organizations")
      .update({ marketplace_default_contact_phone_source: mpDefaultSource } as any)
      .eq("id", profile.organization_id);
    setSavingMpDefault(false);
    if (error) {
      toastError("Erro ao salvar configuração do Marketplace", error, { module: "Settings" });
      return;
    }
    setMpInitialSource(mpDefaultSource);
    queryClient.invalidateQueries({ queryKey: ["org-marketplace-defaults", profile.organization_id] });
    toast.success("Configuração do Marketplace atualizada. Vale para novos imóveis.");
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      {!canEditCompany && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Apenas donos e sub-donos podem alterar os dados da empresa.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
          <CardDescription>Informações da sua organização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-20 w-20 rounded-lg">
                {companyLogoUrl && <AvatarImage src={companyLogoUrl} alt={companyName} className="rounded-lg" />}
                <AvatarFallback className="text-lg rounded-lg"><Building2 className="h-8 w-8 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              {canEditCompany && (
                <label className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="h-5 w-5 text-background" />
                  <input type="file" accept="image/*" className="hidden" disabled={isUploadingAvatar}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !profile?.organization_id) return;
                      const result = await uploadImage(file, 'logos');
                      if (result) {
                        setCompanyLogoUrl(result.url);
                        await supabase.from("organizations").update({ logo_url: result.url }).eq("id", profile.organization_id);
                        toast.success("Logo atualizado!");
                      }
                    }} />
                </label>
              )}
            </div>
            <div>
              <p className="font-medium">{companyName || "Sua empresa"}</p>
              <p className="text-sm text-muted-foreground">
                {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da empresa</Label>
              <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={!canEditCompany} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <div className="flex gap-2">
                <Input id="cnpj" value={companyCnpj} onChange={e => setCompanyCnpj(e.target.value)} placeholder="00.000.000/0001-00" disabled={!canEditCompany} className="flex-1" />
                {canEditCompany && (
                  <Button type="button" variant="outline" size="icon" onClick={handleSearchCnpj} disabled={searchingCnpj}>
                    {searchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CNPJ e clique na lupa para preencher automaticamente</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Telefone</Label>
              <Input id="company-phone" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} disabled={!canEditCompany} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email</Label>
              <Input id="company-email" type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} disabled={!canEditCompany} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-4">Endereço</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-zipcode">CEP</Label>
                <div className="flex gap-2">
                  <Input id="company-zipcode" value={companyZipcode} onChange={e => setCompanyZipcode(e.target.value)} placeholder="00000-000" disabled={!canEditCompany} className="flex-1" />
                  {canEditCompany && (
                    <Button type="button" variant="outline" size="icon" onClick={handleSearchCep} disabled={searchingCep}>
                      {searchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-state">Estado</Label>
                <Select value={companyState} onValueChange={setCompanyState} disabled={!canEditCompany}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{BRAZILIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-city">Cidade</Label>
                <Input id="company-city" value={companyCity} onChange={e => setCompanyCity(e.target.value)} disabled={!canEditCompany} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-neighborhood">Bairro</Label>
                <Input id="company-neighborhood" value={companyNeighborhood} onChange={e => setCompanyNeighborhood(e.target.value)} disabled={!canEditCompany} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company-street">Rua</Label>
                <Input id="company-street" value={companyStreet} onChange={e => setCompanyStreet(e.target.value)} disabled={!canEditCompany} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-number">Número</Label>
                <Input id="company-number" value={companyNumber} onChange={e => setCompanyNumber(e.target.value)} disabled={!canEditCompany} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-complement">Complemento</Label>
                <Input id="company-complement" value={companyComplement} onChange={e => setCompanyComplement(e.target.value)} disabled={!canEditCompany} />
              </div>
            </div>
          </div>

          {canEditCompany && (
            <div className="flex justify-end">
              <Button onClick={handleSaveCompany} disabled={savingCompany}>
                {savingCompany && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Marketplace
          </CardTitle>
          <CardDescription>
            Define o telefone que outros corretores verão por padrão nos seus imóveis publicados no Marketplace.
            Esta configuração vale apenas para <strong>novos imóveis</strong>: imóveis já existentes mantêm a configuração individual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="text-sm font-medium">Telefone padrão dos imóveis no Marketplace</Label>
          <RadioGroup
            value={mpDefaultSource}
            onValueChange={(v) => canEditCompany && setMpDefaultSource(v as MpDefaultSource)}
            className="grid gap-2"
          >
            <label
              htmlFor="mp-default-organization"
              className={cn(
                "flex items-start gap-3 rounded-md border p-3 transition-colors",
                mpDefaultSource === "organization" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                canEditCompany ? "cursor-pointer" : "cursor-not-allowed opacity-70",
              )}
            >
              <RadioGroupItem value="organization" id="mp-default-organization" className="mt-1" disabled={!canEditCompany} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Número da imobiliária
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Novos imóveis publicados no Marketplace usarão o telefone público da imobiliária por padrão.
                </div>
              </div>
            </label>

            <label
              htmlFor="mp-default-owner"
              className={cn(
                "flex items-start gap-3 rounded-md border p-3 transition-colors",
                mpDefaultSource === "owner" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                canEditCompany ? "cursor-pointer" : "cursor-not-allowed opacity-70",
              )}
            >
              <RadioGroupItem value="owner" id="mp-default-owner" className="mt-1" disabled={!canEditCompany} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Número do proprietário
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Novos imóveis publicados no Marketplace usarão o telefone do proprietário primário por padrão.
                  A publicação será bloqueada se o imóvel não tiver proprietário com telefone válido.
                </div>
                {mpDefaultSource === "owner" && (
                  <div className="mt-2 flex items-start gap-1.5 text-[11px] text-warning-foreground/90 bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
                    <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      Ao usar esta opção, o telefone do proprietário poderá ficar visível para outros corretores no Marketplace nos imóveis publicados.
                    </span>
                  </div>
                )}
              </div>
            </label>
          </RadioGroup>

          {canEditCompany && (
            <div className="flex justify-end">
              <Button
                onClick={handleSaveMpDefault}
                disabled={savingMpDefault || mpDefaultSource === mpInitialSource}
              >
                {savingMpDefault && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar configuração
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PropertyReviewSettingsCard />

      <BackupSettingsCard />
    </div>
  );
}
