import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Info } from "lucide-react";

interface DocItem {
  id: string;
  label: string;
  required: boolean;
  note?: string;
}

interface DocSection {
  key: string;
  title: string;
  icon: string;
  items: DocItem[];
}

type BuyerProfile = "clt" | "autonomo" | "aposentado" | "rendas_extras";
type SellerProfile = "pf" | "pj";
type PropertyKind = "usado" | "novo";

// ── Helpers de seções reutilizáveis ──

const PERSONAL_BUYER: DocItem[] = [
  { id: "rg_cpf", label: "RG e CPF (cópia)", required: true },
  { id: "comprovante_estado_civil", label: "Comprovante de estado civil (certidão de casamento/nascimento)", required: true },
  { id: "comprovante_endereco", label: "Comprovante de endereço atualizado (água, luz ou telefone)", required: true },
  { id: "email_telefone", label: "E-mail e telefone para contato", required: true },
];

const RENDA_CLT: DocItem[] = [
  { id: "irpf_clt", label: "Imposto de Renda Pessoa Física + recibo de entrega (se houver)", required: false, note: "Se mais de 30 dias de atraso pode ser recusada" },
  { id: "extrato_fgts_clt", label: "Extrato do FGTS atualizado (se for utilizar)", required: false },
  { id: "ctps_clt", label: "CTPS completa (se for utilizar FGTS)", required: false },
  { id: "extrato_bancario_clt", label: "Extratos bancários dos últimos 6 meses", required: true },
  { id: "faturas_cartao_clt", label: "3 últimas faturas de cartão de crédito (se houver)", required: false },
  { id: "holerites_clt", label: "Holerites dos 3 últimos meses", required: true },
];

const RENDA_AUTONOMO: DocItem[] = [
  { id: "irpf_auto", label: "Imposto de Renda Pessoa Física + recibo de entrega", required: true, note: "Original impresso pelo sistema da Receita Federal" },
  { id: "extrato_bancario_auto", label: "Extratos bancários dos últimos 6 meses", required: true },
  { id: "faturas_cartao_auto", label: "3 últimas faturas de cartão de crédito (se houver)", required: false },
  { id: "decore_auto", label: "DECORE — Declaração Comprobatória de Rendimentos (contador)", required: false },
  { id: "notas_fiscais_auto", label: "Notas fiscais (especialmente produtores rurais)", required: false },
];

const RENDA_APOSENTADO: DocItem[] = [
  { id: "extrato_inss", label: "Extrato/comprovante de benefício do INSS (extrato da previdência)", required: true },
  { id: "irpf_apos", label: "Imposto de Renda Pessoa Física + recibo", required: false },
  { id: "extrato_bancario_apos", label: "Extratos bancários dos últimos 6 meses", required: true },
];

const RENDA_EXTRAS: DocItem[] = [
  { id: "contrato_aluguel", label: "Contrato de aluguel (renda de locação)", required: false },
  { id: "extrato_aplicacoes", label: "Extrato de aplicações financeiras (renda de investimentos)", required: false },
];

const IMOVEL_USADO: DocItem[] = [
  { id: "matricula_usado", label: "Matrícula atualizada (até 30 dias)", required: true },
  { id: "iptu_usado", label: "Espelho do IPTU do ano vigente", required: true },
];

const IMOVEL_NOVO: DocItem[] = [
  { id: "matricula_novo", label: "Matrícula atualizada", required: true },
  { id: "iptu_novo", label: "Espelho do IPTU do ano vigente", required: true },
  { id: "decl_construtivos", label: "Declaração de Elementos Construtivos (padrão Caixa)", required: true },
  { id: "art_rrt", label: "ART ou RRT de projeto e execução", required: true },
  { id: "valor_venal", label: "Certidão de valor venal", required: true },
  { id: "habite_se", label: "Habite-se", required: true },
  { id: "crea_cau", label: "CREA ou CAU do responsável técnico da obra", required: true },
];

const VENDEDOR_PF: DocItem[] = [
  { id: "rg_cpf_vend_pf", label: "RG e CPF do vendedor", required: true },
  { id: "estado_civil_vend_pf", label: "Comprovante de estado civil", required: true },
  { id: "agencia_conta_pf", label: "Agência e conta para recebimento (será aberta poupança na Caixa)", required: true },
  { id: "endereco_vend_pf", label: "Comprovante de residência atualizado", required: true },
];

const VENDEDOR_PJ: DocItem[] = [
  { id: "autorizacao_pj", label: "Autorização de vendas PJ", required: true },
  { id: "contrato_social_pj", label: "Contrato social/estatuto ou última alteração consolidada", required: true },
  { id: "rg_socios_pj", label: "RG dos sócios e respectivos cônjuges (quando houver)", required: true },
  { id: "cpf_socios_pj", label: "CPF dos sócios e respectivos cônjuges (quando houver)", required: true },
  { id: "qualificacao_socios_pj", label: "Endereço e profissão dos sócios (qualificação)", required: true },
  { id: "breve_relato_pj", label: "Ficha de Breve Relato JUCESP", required: true },
  { id: "ficha_cadastral_pj", label: "Ficha Cadastral Completa JUCESP", required: true },
  { id: "certidao_simplificada_pj", label: "Certidão Simplificada atualizada", required: false, note: "Necessária na venda; na captação verificar se sócio assina" },
  { id: "agencia_conta_pj", label: "Agência e conta para recebimento do crédito imobiliário", required: true },
  { id: "cnpj_pj", label: "Cartão do CNPJ + certidão conjunta de débitos (Receita Federal)", required: true },
  { id: "regularidade_rf_pj", label: "Certidão de regularidade da Receita Federal", required: true },
  { id: "regularidade_fgts_pj", label: "Certidão de regularidade do FGTS", required: true },
];

const CERTIDOES_VENDEDOR_PF: DocItem[] = [
  { id: "cnd_federal", label: "Certidão Negativa de Débitos Federais e Dívida Ativa da União (Receita)", required: true },
  { id: "cnd_municipal", label: "Certidão Negativa de Débitos Municipais", required: true },
  { id: "cnd_trabalhista", label: "Certidão Negativa de Débitos Trabalhistas (TST)", required: true },
  { id: "cnd_distribuicao", label: "Certidão Negativa de Distribuição — Cíveis e Criminais (Especial)", required: true },
  { id: "cnd_trf_criminal", label: "Certidão Judicial Criminal (TRF — Tribunal Regional Federal)", required: true },
  { id: "cnd_trf_civel", label: "Certidão Judicial Cível (TRF — Tribunal Regional Federal)", required: true },
  { id: "cnd_trt", label: "Certidão de Ações Trabalhistas (TRT)", required: true },
];

const CERTIDOES_VENDEDOR_PJ: DocItem[] = [
  { id: "cnd_federal_pj", label: "Certidão Negativa de Débitos Federais e Dívida Ativa da União", required: true },
  { id: "cnd_estadual_pj", label: "Certidão Negativa de Débitos Estaduais", required: true },
  { id: "cnd_trabalhista_pj", label: "Certidão Negativa de Débitos Trabalhistas", required: true },
  { id: "cnd_distribuicao_pj", label: "Certidão Negativa de Distribuição — Cíveis, Criminais, Falência e Recuperação Judicial", required: true },
  { id: "cnd_judicial_pj", label: "Certidão Judicial Cível e Criminal", required: true },
  { id: "cnd_trt_pj", label: "Certidão de Ações Trabalhistas em Tramitação (TRT)", required: true },
  { id: "consulta_empregador_pj", label: "Consulta Regularidade do Empregador", required: true },
];

const CERTIDOES_IMOVEL: DocItem[] = [
  { id: "cnd_iptu", label: "Certidão Negativa de IPTU", required: true },
  { id: "cnd_condominio", label: "Certidão Negativa de Condomínio", required: true },
  { id: "iptu_pago", label: "Comprovantes de IPTU pago do ano vigente", required: false, note: "Recomendável" },
  { id: "valor_venal_rec", label: "Certidão de Valor Venal", required: false, note: "Recomendável" },
];

// ── Bancos: estrutura simplificada (mantida para Caixa/BB) ──
const BANK_LABELS: Record<string, string> = {
  caixa: "Caixa Econômica Federal",
  bb: "Banco do Brasil",
  itau: "Itaú Unibanco",
  santander: "Santander",
  bradesco: "Bradesco",
};

function buildSections(
  buyerProfile: BuyerProfile,
  sellerProfile: SellerProfile,
  propertyKind: PropertyKind,
): DocSection[] {
  const rendaMap: Record<BuyerProfile, { title: string; items: DocItem[] }> = {
    clt: { title: "Renda — CLT", items: RENDA_CLT },
    autonomo: { title: "Renda — Liberais / Autônomos / Empresários / MEI", items: RENDA_AUTONOMO },
    aposentado: { title: "Renda — Aposentados e Pensionistas", items: RENDA_APOSENTADO },
    rendas_extras: { title: "Renda Extra — Locação / Investimentos", items: RENDA_EXTRAS },
  };

  return [
    { key: "buyer_personal", title: "Comprador — Documentos Pessoais", icon: "👤", items: PERSONAL_BUYER },
    { key: "buyer_income", title: rendaMap[buyerProfile].title, icon: "💼", items: rendaMap[buyerProfile].items },
    {
      key: "property",
      title: propertyKind === "novo" ? "Imóvel Novo" : "Imóvel Usado",
      icon: "🏠",
      items: propertyKind === "novo" ? IMOVEL_NOVO : IMOVEL_USADO,
    },
    {
      key: "seller",
      title: sellerProfile === "pj" ? "Vendedor — Pessoa Jurídica" : "Vendedor — Pessoa Física",
      icon: "🤝",
      items: sellerProfile === "pj" ? VENDEDOR_PJ : VENDEDOR_PF,
    },
    {
      key: "seller_certs",
      title: sellerProfile === "pj" ? "Certidões Negativas — Vendedor PJ" : "Certidões Negativas — Vendedor PF",
      icon: "📜",
      items: sellerProfile === "pj" ? CERTIDOES_VENDEDOR_PJ : CERTIDOES_VENDEDOR_PF,
    },
    { key: "property_certs", title: "Certidões Negativas — Imóvel", icon: "🧾", items: CERTIDOES_IMOVEL },
  ];
}

const STORAGE_KEY = "financing_docs_checklist_v1";

export function FinancingDocsChecklist() {
  const [selectedBank, setSelectedBank] = useState("caixa");
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile>("clt");
  const [sellerProfile, setSellerProfile] = useState<SellerProfile>("pf");
  const [propertyKind, setPropertyKind] = useState<PropertyKind>("usado");
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch {
      return new Set();
    }
  });

  const sections = useMemo(
    () => buildSections(buyerProfile, sellerProfile, propertyKind),
    [buyerProfile, sellerProfile, propertyKind],
  );

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // localStorage indisponível (modo privado / quota) — falha silenciosa
      }
      return next;
    });
  };

  const allDocs = sections.flatMap((s) => s.items);
  const requiredCount = allDocs.filter((d) => d.required).length;
  const checkedRequired = allDocs.filter((d) => d.required && checked.has(d.id)).length;
  const progress = requiredCount > 0 ? Math.round((checkedRequired / requiredCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Checklist de Documentação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Banco</Label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BANK_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil do Comprador</Label>
              <Select value={buyerProfile} onValueChange={(v) => setBuyerProfile(v as BuyerProfile)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="autonomo">Autônomo / Liberal / MEI</SelectItem>
                  <SelectItem value="aposentado">Aposentado / Pensionista</SelectItem>
                  <SelectItem value="rendas_extras">Renda extra (aluguel/investimentos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendedor</Label>
              <Select value={sellerProfile} onValueChange={(v) => setSellerProfile(v as SellerProfile)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Imóvel</Label>
              <Select value={propertyKind} onValueChange={(v) => setPropertyKind(v as PropertyKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usado">Usado</SelectItem>
                  <SelectItem value="novo">Novo / Construção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {checkedRequired} de {requiredCount} obrigatórios concluídos
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{progress}%</div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">DIRPF:</strong> deve ser a mais recente, entregue no prazo legal (atrasos &gt; 30 dias podem ser recusados).
              Retificadora aceita se a original foi entregue dentro do prazo. <strong className="text-foreground">Holerites/extratos:</strong> geralmente exigidos dos 3 últimos meses.
            </span>
          </div>
        </CardContent>
      </Card>

      {sections.map((sec) => (
        <Card key={sec.key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span>{sec.icon}</span> {sec.title}
              <Badge variant="secondary" className="ml-auto text-xs">
                {sec.items.filter((i) => checked.has(i.id)).length}/{sec.items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {sec.items.map((doc) => (
              <label key={doc.id} className="flex items-start gap-3 cursor-pointer group py-1">
                <Checkbox
                  checked={checked.has(doc.id)}
                  onCheckedChange={() => toggle(doc.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${checked.has(doc.id) ? "line-through text-muted-foreground" : ""}`}>
                    {doc.label}
                  </span>
                  {doc.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.note}</p>
                  )}
                </div>
                {doc.required && (
                  <Badge variant="outline" className="text-xs shrink-0">Obrigatório</Badge>
                )}
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
