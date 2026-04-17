/**
 * QuickFormDialog — Modo ad-hoc para gerar formulários bancários
 * sem precisar criar processo no Pipeline.
 *
 * NÃO persiste no banco de dados. Para histórico/gestão, use o Pipeline.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateBankForm } from "./BankFormGenerator";
import { EMPTY_FORM, BANK_COLORS, type FinancingProcess } from "./types";

type FieldDef = { key: keyof typeof EMPTY_FORM; label: string; type?: "text" | "number" | "date" | "email"; placeholder?: string };

type Section = { title: string; fields: FieldDef[] };

const CLIENT_BASIC: Section = {
  title: "Dados do Cliente",
  fields: [
    { key: "clientName", label: "Nome completo", placeholder: "João da Silva" },
    { key: "clientCpf", label: "CPF", placeholder: "000.000.000-00" },
    { key: "clientRg", label: "RG" },
    { key: "clientBirthDate", label: "Data de nascimento", type: "date" },
    { key: "clientPhone", label: "Telefone", placeholder: "(00) 00000-0000" },
    { key: "clientEmail", label: "E-mail", type: "email" },
  ],
};

const CLIENT_FULL: Section = {
  title: "Dados Pessoais (cont.)",
  fields: [
    { key: "clientNationality", label: "Nacionalidade" },
    { key: "clientMaritalStatus", label: "Estado civil (solteiro/casado/...)" },
    { key: "clientOccupation", label: "Profissão" },
    { key: "clientMonthlyIncome", label: "Renda mensal (R$)", type: "number" },
    { key: "clientAddress", label: "Endereço residencial" },
    { key: "clientCity", label: "Cidade" },
    { key: "clientState", label: "UF" },
    { key: "clientCep", label: "CEP" },
  ],
};

const PROPERTY: Section = {
  title: "Dados do Imóvel",
  fields: [
    { key: "propertyAddress", label: "Endereço do imóvel" },
    { key: "propertyCity", label: "Cidade" },
    { key: "propertyState", label: "UF" },
    { key: "propertyRegistration", label: "Matrícula" },
    { key: "propertyValue", label: "Valor do imóvel (R$)", type: "number" },
  ],
};

const FINANCING: Section = {
  title: "Dados do Financiamento",
  fields: [
    { key: "financingValue", label: "Valor financiado (R$)", type: "number" },
    { key: "downPayment", label: "Entrada (R$)", type: "number" },
    { key: "financingTermMonths", label: "Prazo (meses)", type: "number" },
  ],
};

function sectionsForForm(formId: string): Section[] {
  if (formId.endsWith("_saude")) return [CLIENT_BASIC];
  if (formId === "caixa_fgts") return [CLIENT_BASIC, PROPERTY];
  if (formId.endsWith("_ficha") || formId.endsWith("_declaracao"))
    return [CLIENT_BASIC, CLIENT_FULL];
  // proposta (default) → tudo
  return [CLIENT_BASIC, CLIENT_FULL, PROPERTY, FINANCING];
}

function safeUUID() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankCode: string;
  formId: string;
  formName: string;
}

export function QuickFormDialog({ open, onOpenChange, bankCode, formId, formName }: Props) {
  const sections = useMemo(() => sectionsForForm(formId), [formId]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [generating, setGenerating] = useState(false);

  const filledCount = Object.values(values).filter(
    (v) => v !== "" && v !== undefined && v !== null && v !== 0,
  ).length;

  const bank = BANK_COLORS[bankCode];

  const handleChange = (key: string, raw: string, type?: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: type === "number" ? (raw === "" ? 0 : Number(raw)) : raw,
    }));
  };

  const handleGenerate = () => {
    setGenerating(true);
    try {
      const proc: FinancingProcess = {
        ...EMPTY_FORM,
        ...values,
        bank: bankCode,
        id: safeUUID(),
        stage: "ad_hoc",
        createdAt: new Date(),
      } as FinancingProcess;

      generateBankForm(proc, formId);
      console.info("[corban] form_generated", { bankCode, formId, mode: "ad_hoc", filledCount });
      toast.success("Formulário gerado", { description: "PDF baixado com sucesso." });
      onOpenChange(false);
      setValues({});
    } catch (err) {
      console.error("[corban] form_generation_error", err);
      toast.error("Erro ao gerar formulário", {
        description: "Tente novamente ou preencha menos campos.",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {bank && (
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: bank.primary }}
              />
            )}
            <DialogTitle>{formName}</DialogTitle>
          </div>
          <DialogDescription>
            {bank?.name} · Geração avulsa (não salva no Pipeline). Preencha o que tiver — campos
            vazios virarão linhas para preenchimento manual.
          </DialogDescription>
        </DialogHeader>

        {filledCount > 0 && filledCount < 3 && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              PDF será gerado com a maioria dos campos em branco para preenchimento manual.
            </span>
          </div>
        )}

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map((f) => (
                  <div key={f.key as string} className="space-y-1.5">
                    <Label htmlFor={f.key as string} className="text-xs">
                      {f.label}
                    </Label>
                    <Input
                      id={f.key as string}
                      type={f.type || "text"}
                      placeholder={f.placeholder}
                      value={(values[f.key as string] as string | number | undefined) ?? ""}
                      onChange={(e) => handleChange(f.key as string, e.target.value, f.type)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" /> Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
