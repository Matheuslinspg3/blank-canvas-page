import { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Store, Building, User, Phone, AlertCircle, ShieldAlert } from "lucide-react";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useBrokers } from "@/hooks/useBrokers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useOrgMarketplaceDefaults } from "@/hooks/useOrgMarketplaceDefaults";

interface BasicTabProps {
  form: UseFormReturn<any>;
  publishToMarketplace?: boolean;
  /** Optional id of the property being edited (used to look up primary owner phone) */
  propertyId?: string | null;
}

type Source = "organization" | "owner" | "custom";

export function BasicTab({ form, publishToMarketplace = false, propertyId }: BasicTabProps) {
  const { propertyTypes, createPropertyType, isCreating: isCreatingType } = usePropertyTypes();
  const { brokers } = useBrokers();
  const { profile } = useAuth();
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const propertyCondition = form.watch("property_condition");
  const sourceValue = (form.watch("marketplace_contact_phone_source") as Source) || "organization";
  const formOwnerPhone = form.watch("owner_phone") as string | null | undefined;
  const { defaultSource: orgDefaultSource } = useOrgMarketplaceDefaults();
  const orgDefaultLabel = orgDefaultSource === "owner" ? "Número do proprietário" : "Número da imobiliária";

  // Resolve organization & primary-owner phones to display in the radio cards.
  const [orgPhone, setOrgPhone] = useState<string | null>(null);
  const [ownerPhoneFromDb, setOwnerPhoneFromDb] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) return;
    let cancelled = false;
    supabase.from("organizations").select("phone").eq("id", profile.organization_id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setOrgPhone((data?.phone as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [profile?.organization_id]);

  useEffect(() => {
    if (!propertyId) { setOwnerPhoneFromDb(null); return; }
    let cancelled = false;
    supabase.from("property_owners").select("phone").eq("property_id", propertyId).eq("is_primary", true).maybeSingle()
      .then(({ data }) => { if (!cancelled) setOwnerPhoneFromDb((data?.phone as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [propertyId]);

  // Effective owner phone: prefer the value already typed in the form (live), fallback to DB.
  const effectiveOwnerPhone = (formOwnerPhone && String(formOwnerPhone).trim().length > 0)
    ? String(formOwnerPhone).trim()
    : ownerPhoneFromDb;

  const handleCreateNewType = () => {
    if (newTypeName.trim()) {
      createPropertyType(newTypeName.trim());
      setNewTypeName("");
      setShowNewTypeInput(false);
    }
  };

  const orgPhoneValid = !!(orgPhone && orgPhone.trim().length >= 8);
  const ownerPhoneValid = !!(effectiveOwnerPhone && effectiveOwnerPhone.trim().length >= 8);
  const sourceIsOwnerWithoutPhone = sourceValue === "owner" && !ownerPhoneValid;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="property_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Imóvel *</FormLabel>
              {showNewTypeInput ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do novo tipo"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    disabled={isCreatingType}
                  />
                  <Button type="button" size="sm" onClick={handleCreateNewType} disabled={isCreatingType || !newTypeName.trim()}>
                    {isCreatingType ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewTypeInput(false); setNewTypeName(""); }}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select
                  onValueChange={(value) => {
                    if (value === "new") setShowNewTypeInput(true);
                    else field.onChange(value);
                  }}
                  value={field.value || undefined}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                    <SelectItem value="new" className="text-primary font-medium">
                      <div className="flex items-center gap-2"><Plus className="h-4 w-4" />Criar novo tipo...</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transaction_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Transação *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                  <SelectItem value="ambos">Venda e Aluguel</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="com_proposta">Com Proposta</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="property_condition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condição do Imóvel</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="captador_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Corretor Captador</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o captador" /></SelectTrigger></FormControl>
                <SelectContent>
                  {brokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.user_id}>{broker.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="development_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Empreendimento</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Residencial Mar Azul" {...field} value={field.value || ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {propertyCondition === "novo" && (
        <FormField
          control={form.control}
          name="launch_stage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Etapa de Lançamento</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "nenhum"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  <SelectItem value="futuro">Futuro (Lançamento)</SelectItem>
                  <SelectItem value="em_construcao">Em Construção</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {publishToMarketplace && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Store className="h-4 w-4 text-primary" />
            Telefone exibido no Marketplace
          </div>
          <p className="text-xs text-muted-foreground">
            Escolha qual número outros corretores verão no card deste imóvel.
            Não afeta landing pages nem o contato exibido para clientes finais.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Padrão da imobiliária: <span className="font-medium text-foreground">{orgDefaultLabel}</span>
          </p>

          <FormField
            control={form.control}
            name="marketplace_contact_phone_source"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={(field.value as Source) || "organization"}
                    onValueChange={field.onChange}
                    className="grid gap-2"
                  >
                    {/* Organization */}
                    <label
                      htmlFor="src-organization"
                      className={cn(
                        "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                        sourceValue === "organization" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <RadioGroupItem value="organization" id="src-organization" className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          Número da imobiliária
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {orgPhoneValid ? orgPhone : "Imobiliária sem telefone público cadastrado"}
                        </div>
                      </div>
                    </label>

                    {/* Owner */}
                    <label
                      htmlFor="src-owner"
                      className={cn(
                        "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                        sourceValue === "owner" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <RadioGroupItem value="owner" id="src-owner" className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Número do proprietário
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {ownerPhoneValid ? effectiveOwnerPhone : "Proprietário sem telefone cadastrado"}
                        </div>
                        {sourceValue === "owner" && (
                          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-warning-foreground/90 bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
                            <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              Ao selecionar esta opção, o telefone do proprietário ficará visível para outros corretores no Marketplace.
                            </span>
                          </div>
                        )}
                        {sourceIsOwnerWithoutPhone && (
                          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              Telefone do proprietário ausente. Cadastre um telefone na aba "Local" antes de publicar.
                            </span>
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Custom */}
                    <label
                      htmlFor="src-custom"
                      className={cn(
                        "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                        sourceValue === "custom" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <RadioGroupItem value="custom" id="src-custom" className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          Telefone personalizado
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Use um número específico para este anúncio.
                        </div>
                        {sourceValue === "custom" && (
                          <div className="mt-2">
                            <FormField
                              control={form.control}
                              name="marketplace_contact_phone"
                              render={({ field: phoneField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="(11) 99999-9999"
                                      {...phoneField}
                                      value={phoneField.value || ""}
                                      inputMode="tel"
                                      maxLength={20}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-[11px]">
                                    Apenas dígitos, +, -, ( ) e espaços (8 a 20 caracteres).
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
