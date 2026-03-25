import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Building2 } from "lucide-react";

interface DocItem {
  id: string;
  label: string;
  required: boolean;
}

interface BankDocs {
  buyer: DocItem[];
  seller: DocItem[];
  property: DocItem[];
}

const BANK_DOCS: Record<string, BankDocs> = {
  caixa: {
    buyer: [
      { id: "rg", label: "RG e CPF (cópia)", required: true },
      { id: "comprovante_renda", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "comprovante_residencia", label: "Comprovante de residência", required: true },
      { id: "certidao_casamento", label: "Certidão de casamento / nascimento", required: true },
      { id: "irpf", label: "Declaração IRPF (último exercício)", required: true },
      { id: "extrato_fgts", label: "Extrato do FGTS", required: false },
      { id: "carteira_trabalho", label: "Carteira de trabalho (cópia)", required: false },
    ],
    seller: [
      { id: "rg_vendedor", label: "RG e CPF do vendedor", required: true },
      { id: "certidao_casamento_vendedor", label: "Certidão de casamento / nascimento", required: true },
      { id: "certidao_negativa_debitos", label: "Certidão negativa de débitos federais", required: true },
      { id: "certidao_acoes", label: "Certidão de ações cíveis e criminais", required: true },
    ],
    property: [
      { id: "matricula", label: "Matrícula atualizada (30 dias)", required: true },
      { id: "iptu", label: "Carnê IPTU / Certidão valor venal", required: true },
      { id: "habite_se", label: "Habite-se", required: true },
      { id: "certidao_onus", label: "Certidão de ônus reais", required: true },
      { id: "avcb", label: "AVCB (se apartamento)", required: false },
    ],
  },
  bb: {
    buyer: [
      { id: "rg", label: "RG e CPF", required: true },
      { id: "comprovante_renda", label: "Comprovante de renda (3 últimos meses)", required: true },
      { id: "comprovante_residencia", label: "Comprovante de residência", required: true },
      { id: "irpf", label: "Declaração IRPF", required: true },
      { id: "certidao_casamento", label: "Certidão de estado civil", required: true },
    ],
    seller: [
      { id: "rg_vendedor", label: "RG e CPF do vendedor", required: true },
      { id: "certidao_negativa_debitos", label: "Certidões negativas", required: true },
    ],
    property: [
      { id: "matricula", label: "Matrícula atualizada", required: true },
      { id: "iptu", label: "IPTU", required: true },
      { id: "habite_se", label: "Habite-se", required: true },
    ],
  },
};

const CATEGORIES = [
  { key: "buyer" as const, label: "Comprador", icon: "👤" },
  { key: "seller" as const, label: "Vendedor", icon: "🏠" },
  { key: "property" as const, label: "Imóvel", icon: "📋" },
];

export function FinancingDocsChecklist() {
  const [selectedBank, setSelectedBank] = useState("caixa");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const docs = BANK_DOCS[selectedBank] || BANK_DOCS.caixa;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allDocs = [...docs.buyer, ...docs.seller, ...docs.property];
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
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <Label>Banco</Label>
              <Select value={selectedBank} onValueChange={(v) => { setSelectedBank(v); setChecked(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caixa">Caixa Econômica</SelectItem>
                  <SelectItem value="bb">Banco do Brasil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{progress}%</div>
              <p className="text-xs text-muted-foreground">Obrigatórios</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {CATEGORIES.map((cat) => {
        const items = docs[cat.key];
        if (!items?.length) return null;
        return (
          <Card key={cat.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{cat.icon}</span> Documentos do {cat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((doc) => (
                <label key={doc.id} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox checked={checked.has(doc.id)} onCheckedChange={() => toggle(doc.id)} />
                  <span className={`text-sm flex-1 ${checked.has(doc.id) ? "line-through text-muted-foreground" : ""}`}>
                    {doc.label}
                  </span>
                  {doc.required && <Badge variant="outline" className="text-xs">Obrigatório</Badge>}
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
