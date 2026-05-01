import { useState, useEffect, useCallback, useRef } from "react";
import { trackFormError, trackPropertyCreated } from "@/components/ClarityProvider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PropertyWithDetails, PropertyFormData } from "@/hooks/useProperties";
import { TAB_FIELDS } from "./form/constants";
import { BasicTab } from "./form/BasicTab";
import { ValuesTab } from "./form/ValuesTab";
import { FeaturesTab } from "./form/FeaturesTab";
import { LocationTab } from "./form/LocationTab";
import { PhotosTab } from "./form/PhotosTab";
import { DescriptionTab } from "./form/DescriptionTab";
import { OwnerSection } from "./form/OwnerSection";
import { useOrgMarketplaceDefaults } from "@/hooks/useOrgMarketplaceDefaults";

// Re-export constants for backward compatibility
export { AMENITIES_OPTIONS, PAYMENT_OPTIONS } from "./form/constants";

const propertySchema = z.object({
  title: z.string().optional().nullable(),
  property_type_id: z.string().min(1, 'Tipo de imóvel é obrigatório'),
  transaction_type: z.enum(["venda", "aluguel", "ambos"] as const),
  status: z.enum(["disponivel", "reservado", "vendido", "alugado", "inativo", "com_proposta", "suspenso"] as const),
  launch_stage: z.enum(["nenhum", "em_construcao", "pronto", "futuro"] as const).optional().nullable(),
  development_name: z.string().optional().nullable(),
  property_condition: z.enum(["novo", "usado"] as const).optional().nullable(),
  captador_id: z.string().optional().nullable(),
  sale_price: z.coerce.number().nullable().optional(),
  sale_price_financed: z.coerce.number().nullable().optional(),
  rent_price: z.coerce.number().nullable().optional(),
  condominium_fee: z.coerce.number().nullable().optional(),
  iptu: z.coerce.number().nullable().optional(),
  iptu_monthly: z.coerce.number().nullable().optional(),
  inspection_fee: z.coerce.number().nullable().optional(),
  commission_type: z.enum(["valor", "percentual"] as const).optional().nullable(),
  commission_value: z.coerce.number().nullable().optional(),
  bedrooms: z.coerce.number().int().min(0, 'Informe os quartos'),
  suites: z.coerce.number().int().min(0).nullable().optional(),
  bathrooms: z.coerce.number().int().min(0, 'Informe os banheiros'),
  parking_spots: z.coerce.number().int().min(0).nullable().optional(),
  area_useful: z.coerce.number().min(0.01, 'Informe a área útil'),
  area_total: z.coerce.number().nullable().optional(),
  area_built: z.coerce.number().nullable().optional(),
  floor: z.coerce.number().int().nullable().optional(),
  beach_distance_meters: z.coerce.number().int().nullable().optional(),
  address_zipcode: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  youtube_url: z.string().url().optional().nullable().or(z.literal("")),
  amenities: z.array(z.string()).optional().nullable(),
  payment_options: z.array(z.string()).optional().nullable(),
  owner_name: z.string().optional().nullable().or(z.literal("")),
  owner_phone: z.string().optional().nullable(),
  owner_email: z.string().email().optional().nullable().or(z.literal("")),
  owner_document: z.string().optional().nullable(),
  owner_notes: z.string().optional().nullable(),
  marketplace_contact_phone: z.string().trim().regex(/^[0-9+()\-\s]{8,20}$/, 'Telefone inválido (8 a 20 dígitos, com +, -, () permitidos)').optional().nullable().or(z.literal("")),
  marketplace_contact_phone_source: z.enum(["organization", "owner", "custom"] as const).default("organization"),
}).superRefine((data, ctx) => {
  if (data.transaction_type === "venda" && !data.sale_price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sale_price"], message: "Informe pelo menos um preço para o tipo de transação selecionado" });
  }
  if (data.transaction_type === "aluguel" && !data.rent_price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sale_price"], message: "Informe pelo menos um preço para o tipo de transação selecionado" });
  }
  if (data.transaction_type === "ambos" && !data.sale_price && !data.rent_price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sale_price"], message: "Informe pelo menos um preço para o tipo de transação selecionado" });
  }
  // marketplace_contact_phone obrigatório quando source = custom (validação client; trigger valida no servidor)
  if (data.marketplace_contact_phone_source === "custom") {
    const v = (data.marketplace_contact_phone || "").trim();
    if (v.length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["marketplace_contact_phone"], message: "Informe um telefone válido para o contato personalizado." });
    }
  }
});

type FormData = z.infer<typeof propertySchema>;

interface PropertyImage {
  id?: string;
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
  phash?: string;
  r2_key_full?: string;
  r2_key_thumb?: string;
  storage_provider?: string;
  cached_thumbnail_url?: string;
}

interface OwnerData {
  name?: string;
  phone?: string;
  email?: string;
  document?: string;
  notes?: string;
}

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: PropertyWithDetails | null;
  onSubmit: (data: PropertyFormData, images: PropertyImage[], ownerData?: OwnerData, publishToMarketplace?: boolean) => Promise<void>;
  isSubmitting: boolean;
  prefillData?: Record<string, any> | null;
  isPublished?: boolean;
}

const DEFAULT_VALUES: FormData = {
  title: "", property_type_id: null, transaction_type: "venda", status: "disponivel",
  launch_stage: "nenhum", development_name: null, property_condition: null, captador_id: null,
  sale_price: null, sale_price_financed: null, rent_price: null, condominium_fee: null,
  iptu: null, iptu_monthly: null, inspection_fee: null, commission_type: "percentual", commission_value: null,
  bedrooms: 0, suites: 0, bathrooms: 0, parking_spots: 0,
  area_useful: 0, area_total: null, area_built: null, floor: null, beach_distance_meters: null,
  address_zipcode: "", address_street: "", address_number: "", address_complement: "",
  address_neighborhood: "", address_city: "", address_state: "",
  description: "", youtube_url: "", amenities: [], payment_options: [],
  owner_name: "", owner_phone: "", owner_email: "", owner_document: "", owner_notes: "",
  marketplace_contact_phone: "",
  marketplace_contact_phone_source: "organization",
};

export function PropertyForm({ open, onOpenChange, property, onSubmit, isSubmitting, prefillData, isPublished = false }: PropertyFormProps) {
  const { propertyTypes } = usePropertyTypes();
  const { toast } = useToast();
  const { defaultSource: orgDefaultSource, isFetched: orgDefaultFetched } = useOrgMarketplaceDefaults();
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [publishToMarketplace, setPublishToMarketplace] = useState(false);
  const formStartRef = useRef(Date.now());
  // Guard against double-submit (rapid double-click, Enter+click, re-renders).
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open) formStartRef.current = Date.now();
  }, [open]);

  const form = useForm<FormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Watch for conditional logic
  const propertyCondition = form.watch("property_condition");

  useEffect(() => {
    if (propertyCondition !== "novo") {
      form.setValue("launch_stage", "nenhum");
    }
  }, [propertyCondition, form]);

  // Reset form when property changes
  useEffect(() => {
    if (property) {
      const loadPropertyData = async () => {
        let ownerName = "";
        let ownerPhone = "";
        let ownerEmail = "";
        let ownerDocument = "";
        let ownerNotes = "";

        // Pre-load owner data for editing
        try {
          const { data: owner } = await supabase
            .from("property_owners")
            .select("name, phone, email, document, notes")
            .eq("property_id", property.id)
            .eq("is_primary", true)
            .maybeSingle();
          if (owner) {
            ownerName = owner.name || "";
            ownerPhone = owner.phone || "";
            ownerEmail = owner.email || "";
            ownerDocument = owner.document || "";
            ownerNotes = owner.notes || "";
          }
        } catch (e) {
          // ignore – owner fields will remain empty
        }

        // Fetch ALL images for the edit form
        let allImages: { id: string; url: string; is_cover: boolean; display_order: number }[] = [];
        try {
          const { data: imgRows } = await supabase
            .from("property_images")
            .select("id, url, is_cover, display_order, r2_key_thumb, cached_thumbnail_url, r2_key_full, storage_provider, phash")
            .eq("property_id", property.id)
            .order("display_order");
          allImages = (imgRows || []).map((img: any) => ({
            id: img.id, url: img.url, is_cover: img.is_cover || false, display_order: img.display_order || 0,
            phash: img.phash || undefined,
            r2_key_full: img.r2_key_full || undefined,
            r2_key_thumb: img.r2_key_thumb || undefined,
            storage_provider: img.storage_provider || undefined,
            cached_thumbnail_url: img.cached_thumbnail_url || undefined,
          }));
        } catch (e) {
          // Fallback to property.images if fetch fails
          allImages = (property.images || []).map(img => ({
            id: img.id, url: img.url, is_cover: img.is_cover || false, display_order: img.display_order || 0,
          }));
        }

        form.reset({
          title: property.title, property_type_id: property.property_type_id,
          transaction_type: property.transaction_type, status: property.status,
          launch_stage: (property as any).launch_stage || "nenhum",
          development_name: (property as any).development_name || null,
          property_condition: (property as any).property_condition || null,
          captador_id: (property as any).captador_id || null,
          sale_price: property.sale_price, sale_price_financed: (property as any).sale_price_financed || null,
          rent_price: property.rent_price, condominium_fee: property.condominium_fee,
          iptu: property.iptu, iptu_monthly: (property as any).iptu_monthly || null,
          inspection_fee: (property as any).inspection_fee || null,
          commission_type: (property as any).commission_type || "percentual",
          commission_value: (property as any).commission_value || null,
          bedrooms: property.bedrooms, suites: property.suites,
          bathrooms: property.bathrooms, parking_spots: property.parking_spots,
          area_useful: (property as any).area_useful ? Number((property as any).area_useful) : null,
          area_total: property.area_total ? Number(property.area_total) : null,
          area_built: property.area_built ? Number(property.area_built) : null,
          floor: property.floor, beach_distance_meters: (property as any).beach_distance_meters || null,
          address_zipcode: property.address_zipcode || "", address_street: property.address_street || "",
          address_number: property.address_number || "", address_complement: property.address_complement || "",
          address_neighborhood: property.address_neighborhood || "",
          address_city: property.address_city || "", address_state: property.address_state || "",
          description: property.description || "", youtube_url: (property as any).youtube_url || "",
          amenities: property.amenities || [], payment_options: (property as any).payment_options || [],
          owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail,
          owner_document: ownerDocument, owner_notes: ownerNotes,
          marketplace_contact_phone: (property as any).marketplace_contact_phone || "",
          marketplace_contact_phone_source:
            ((property as any).marketplace_contact_phone_source as "organization" | "owner" | "custom" | undefined)
            ?? ((property as any).marketplace_contact_phone ? "custom" : "organization"),
        });
        setImages(allImages);
      };
      loadPropertyData();
    } else if (prefillData) {
      // Novo imóvel com prefill: respeita source explícito do payload; senão usa default da org (se já carregado), senão fallback estático.
      const prefillSource = (prefillData as any)?.marketplace_contact_phone_source;
      const initialSource = prefillSource
        ?? (orgDefaultFetched ? orgDefaultSource : DEFAULT_VALUES.marketplace_contact_phone_source);
      form.reset({ ...DEFAULT_VALUES, ...prefillData, marketplace_contact_phone_source: initialSource });
      setImages([]);
    } else {
      // Novo imóvel: usa default da organização se já carregado; senão fallback estático.
      const initialSource = orgDefaultFetched ? orgDefaultSource : DEFAULT_VALUES.marketplace_contact_phone_source;
      form.reset({ ...DEFAULT_VALUES, marketplace_contact_phone_source: initialSource });
      setImages([]);
    }
    setActiveTab("basic");
    // Reflect actual marketplace state when editing; default OFF for new properties.
    setPublishToMarketplace(property ? isPublished : false);
  }, [property, prefillData, form, open, isPublished, orgDefaultFetched, orgDefaultSource]);

  // Late-arriving org default for NEW properties: if the hook resolves AFTER
  // the initial reset and the user hasn't touched the field yet, sync silently.
  // Never runs for existing properties (preserves saved value).
  useEffect(() => {
    if (!open) return;
    if (property) return;
    if (!orgDefaultFetched) return;
    const dirty = (form.formState.dirtyFields as any)?.marketplace_contact_phone_source;
    if (dirty) return;
    const current = form.getValues("marketplace_contact_phone_source");
    if (current !== orgDefaultSource) {
      form.setValue("marketplace_contact_phone_source", orgDefaultSource, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [open, property, orgDefaultFetched, orgDefaultSource, form]);

  const getTabHasErrors = (tabKey: string): boolean => {
    const fields = TAB_FIELDS[tabKey];
    if (!fields) return false;
    return fields.some((field) => !!form.formState.errors[field as keyof FormData]);
  };

  const findFirstTabWithError = (): string | null => {
    for (const tab of ["basic", "values", "features", "location", "photos", "description"]) {
      if (getTabHasErrors(tab)) return tab;
    }
    return null;
  };

  const handleSubmit = async (data: FormData) => {
    // Guardrail: bloqueia duplo submit (clique duplo, Enter+click, re-render).
    if (submittingRef.current) return;

    // Guardrail: warn if user is hiding a published property by changing its status
    if (isPublished && publishToMarketplace && data.status !== 'disponivel') {
      const statusLabels: Record<string, string> = {
        reservado: 'Reservado', vendido: 'Vendido', alugado: 'Alugado',
        inativo: 'Inativo', com_proposta: 'Com Proposta', suspenso: 'Suspenso',
      };
      const ok = window.confirm(
        `Este imóvel está publicado no Marketplace. Alterar o status para "${statusLabels[data.status] || data.status}" vai escondê-lo da listagem pública (apenas imóveis com status "Disponível" aparecem). Continuar?`
      );
      if (!ok) return;
    }
    const { owner_name, owner_phone, owner_email, owner_document, owner_notes, area_useful, sale_price_financed, marketplace_contact_phone, marketplace_contact_phone_source, ...restData } = data;
    const selectedType = propertyTypes.find(t => t.id === restData.property_type_id);
    const autoTitle = [selectedType?.name, restData.address_neighborhood, restData.address_city].filter(Boolean).join(' - ') || 'Imóvel sem título';
    // Defesa em profundidade: se source != custom, força telefone manual = null (trigger também faz).
    const finalSource = (marketplace_contact_phone_source ?? "organization") as "organization" | "owner" | "custom";
    const normalizedMpPhone = finalSource === "custom"
      ? (marketplace_contact_phone && String(marketplace_contact_phone).trim() !== "" ? String(marketplace_contact_phone).trim() : null)
      : null;
    const propertyData = {
      ...restData,
      title: autoTitle,
      area_useful: area_useful as any,
      sale_price_financed: sale_price_financed as any,
      marketplace_contact_phone: normalizedMpPhone as any,
      marketplace_contact_phone_source: finalSource as any,
      // Defesa: se em modo edição o form devolveu null por algum race no reset, preserva o valor original.
      property_type_id: restData.property_type_id || (property as any)?.property_type_id || restData.property_type_id,
      captador_id: (restData as any).captador_id || (property as any)?.captador_id || (restData as any).captador_id,
    };
    const ownerData: OwnerData | undefined = owner_name ? {
      name: owner_name, phone: owner_phone || undefined, email: owner_email || undefined,
      document: owner_document || undefined, notes: owner_notes || undefined,
    } : undefined;

    submittingRef.current = true;
    try {
      await onSubmit(propertyData as PropertyFormData, images, ownerData, publishToMarketplace);
      if (!property) trackPropertyCreated();
      // Só fecha o dialog em caso de sucesso — assim o usuário pode tentar
      // novamente sem perder os dados se algo falhar.
      onOpenChange(false);
    } catch (err) {
      // Erro já é tratado/toasted pelos hooks; mantemos o form aberto.
      console.error('[PropertyForm] submit failed:', err);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleInvalidSubmit = () => {
    const firstErrorTab = findFirstTabWithError();
    trackFormError('property_form');
    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
      toast({ title: "Campos obrigatórios", description: "Preencha os campos obrigatórios destacados em vermelho.", variant: "destructive" });
    } else if (Object.keys(form.formState.errors).length > 0) {
      toast({ title: "Erro no formulário", description: "Verifique os dados do proprietário e tente novamente.", variant: "destructive" });
    }
  };

  const TabErrorIndicator = ({ tabKey }: { tabKey: string }) => {
    if (!getTabHasErrors(tabKey)) return null;
    return <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{property ? "Editar Imóvel" : "Novo Imóvel"}</DialogTitle>
          <DialogDescription>
            {property ? "Atualize as informações do imóvel" : "Preencha os dados do novo imóvel"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="flex flex-col flex-1 min-h-0 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 min-h-[44px]">
                {[
                  { key: "basic", label: "Básico" },
                  { key: "values", label: "Valores" },
                  { key: "features", label: "Caract." },
                  { key: "location", label: "Local" },
                  { key: "photos", label: "Fotos" },
                  { key: "description", label: "Desc." },
                ].map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="relative text-[11px] sm:text-sm min-h-[44px]">
                    {label}
                    <TabErrorIndicator tabKey={key} />
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="basic" className="flex-1 overflow-y-auto"><BasicTab form={form} publishToMarketplace={publishToMarketplace} propertyId={property?.id ?? null} /></TabsContent>
              <TabsContent value="values" className="flex-1 overflow-y-auto"><ValuesTab form={form} /></TabsContent>
              <TabsContent value="features" className="flex-1 overflow-y-auto"><FeaturesTab form={form} /></TabsContent>
              <TabsContent value="location" className="flex-1 overflow-y-auto">
                <LocationTab form={form} />
                <OwnerSection form={form} isEditing={!!property} />
              </TabsContent>
              <TabsContent value="photos" className="flex-1 overflow-y-auto"><PhotosTab form={form} images={images} onImagesChange={setImages} /></TabsContent>
              <TabsContent value="description" className="flex-1 overflow-y-auto"><DescriptionTab form={form} /></TabsContent>
            </Tabs>

            <DialogFooter className="flex-col sm:flex-row gap-3 sticky bottom-0 bg-background pt-4 pb-1">
              <div className="flex items-center gap-3 mr-auto">
                <Switch id="publish-marketplace" checked={publishToMarketplace} onCheckedChange={setPublishToMarketplace} />
                <Label htmlFor="publish-marketplace" className="flex items-center gap-2 cursor-pointer text-sm font-medium" title="Ligar = publica/atualiza no Marketplace. Desligar = remove do Marketplace.">
                  <Store className="h-4 w-4" />
                  <span className="hidden sm:inline">{isPublished ? 'Publicado no' : 'Publicar no'}</span> Marketplace
                  {isPublished && publishToMarketplace && property && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-success/15 text-success text-[10px] font-semibold px-2 py-0.5">ativo</span>
                  )}
                </Label>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-initial min-h-[44px]">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-initial min-h-[44px]">
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {property ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default PropertyForm;
