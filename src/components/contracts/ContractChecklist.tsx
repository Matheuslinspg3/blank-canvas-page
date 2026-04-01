import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck, Plus, Trash2, AlertCircle, CheckCircle2,
  Clock, FileText, User, Home, Shield,
} from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  done: boolean;
  dueDate?: string;
  notes?: string;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "id" | "done">[] = [
  // Documentos do comprador
  { label: "RG e CPF do comprador", category: "comprador" },
  { label: "Comprovante de renda", category: "comprador" },
  { label: "Comprovante de residência", category: "comprador" },
  { label: "Certidão de estado civil", category: "comprador" },
  { label: "Declaração de IR", category: "comprador" },
  // Documentos do imóvel
  { label: "Matrícula atualizada", category: "imovel" },
  { label: "Certidão negativa de ônus", category: "imovel" },
  { label: "IPTU em dia", category: "imovel" },
  { label: "Habite-se / Auto de conclusão", category: "imovel" },
  { label: "Certidão de inteiro teor", category: "imovel" },
  // Processo
  { label: "Avaliação do imóvel", category: "processo" },
  { label: "Aprovação de crédito", category: "processo" },
  { label: "Assinatura do contrato", category: "processo" },
  { label: "Registro em cartório", category: "processo" },
  { label: "Vistoria final", category: "processo" },
];

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  comprador: { label: "Comprador", icon: User, color: "text-blue-600 dark:text-blue-400" },
  imovel: { label: "Imóvel", icon: Home, color: "text-green-600 dark:text-green-400" },
  processo: { label: "Processo", icon: Shield, color: "text-purple-600 dark:text-purple-400" },
  custom: { label: "Personalizado", icon: FileText, color: "text-orange-600 dark:text-orange-400" },
};

interface Props {
  contractId?: string;
  contractCode?: string;
}

export function ContractChecklist({ contractId, contractCode }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map((item, i) => ({
      ...item,
      id: `default-${i}`,
      done: false,
    }))
  );
  const [newItemLabel, setNewItemLabel] = useState("");

  const toggleItem = (id: string) => {
    setItems(items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const addItem = () => {
    if (!newItemLabel.trim()) return;
    setItems([...items, {
      id: crypto.randomUUID(),
      label: newItemLabel.trim(),
      category: "custom",
      done: false,
    }]);
    setNewItemLabel("");
    toast.success("Item adicionado!");
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const pendingCount = totalCount - doneCount;

  const groupedItems = items.reduce((groups, item) => {
    const cat = item.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
    return groups;
  }, {} as Record<string, ChecklistItem[]>);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold">
              Checklist de Pendências
              {contractCode && <span className="text-muted-foreground font-normal ml-2 text-sm">#{contractCode}</span>}
            </h3>
            <p className="text-xs text-muted-foreground">Acompanhe documentos e etapas do contrato</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={progress === 100 ? "default" : "secondary"} className="gap-1 text-xs">
            {progress === 100 ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {doneCount}/{totalCount}
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="outline" className="gap-1 text-xs text-destructive border-destructive/30">
              <AlertCircle className="h-3 w-3" />
              {pendingCount} pendentes
            </Badge>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <Progress value={progress} className="h-3 rounded-full" />
        <p className="text-xs text-muted-foreground text-right">{progress.toFixed(0)}% concluído</p>
      </div>

      {/* Groups */}
      {Object.entries(groupedItems).map(([cat, categoryItems]) => {
        const config = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.custom;
        const catDone = categoryItems.filter((i) => i.done).length;

        return (
          <Card key={cat} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm font-semibold">{config.label}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {catDone}/{categoryItems.length}
                </Badge>
              </div>

              <div className="space-y-1">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 py-2 px-2 rounded-md transition-colors group ${
                      item.done ? "opacity-60" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                    {item.id.startsWith("default-") ? null : (
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add custom item */}
      <div className="flex gap-2">
        <Input
          placeholder="Adicionar item personalizado..."
          className="h-9 text-sm"
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <Button size="sm" className="h-9 gap-1" onClick={addItem} disabled={!newItemLabel.trim()}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
