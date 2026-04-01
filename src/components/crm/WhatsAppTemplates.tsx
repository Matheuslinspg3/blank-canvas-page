import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare, Copy, Search, Star, Clock, FileText, Home,
  UserPlus, CalendarCheck, AlertCircle, ThumbsUp, Handshake,
} from "lucide-react";

interface Template {
  id: string;
  category: string;
  title: string;
  message: string;
  icon: React.ElementType;
  variables: string[];
}

const TEMPLATES: Template[] = [
  // Primeiro contato
  {
    id: "primeiro_contato",
    category: "primeiro_contato",
    title: "Primeiro contato com lead",
    icon: UserPlus,
    variables: ["nomeCliente", "nomeCorretor", "imobiliaria"],
    message: `Olá {nomeCliente}, tudo bem? 👋

Sou {nomeCorretor} da {imobiliaria}. Vi que você demonstrou interesse em nossos imóveis.

Posso te ajudar a encontrar o imóvel ideal? Qual região e faixa de valor você está buscando?`,
  },
  {
    id: "lead_portal",
    category: "primeiro_contato",
    title: "Lead vindo de portal",
    icon: Home,
    variables: ["nomeCliente", "nomeImovel", "nomeCorretor"],
    message: `Olá {nomeCliente}! 😊

Vi que você se interessou pelo imóvel *{nomeImovel}*. Excelente escolha!

Tenho mais informações e fotos exclusivas desse imóvel. Podemos agendar uma visita? Qual o melhor horário para você?

Atenciosamente,
{nomeCorretor}`,
  },
  // Agendamento
  {
    id: "confirmar_visita",
    category: "agendamento",
    title: "Confirmar visita agendada",
    icon: CalendarCheck,
    variables: ["nomeCliente", "dataVisita", "horario", "enderecoImovel"],
    message: `Olá {nomeCliente}! 📅

Confirmando sua visita:
📍 *{enderecoImovel}*
🗓️ {dataVisita} às {horario}

Por favor, confirme sua presença respondendo esta mensagem. Qualquer imprevisto, me avise com antecedência.

Até lá! 👋`,
  },
  {
    id: "lembrete_visita",
    category: "agendamento",
    title: "Lembrete de visita (1h antes)",
    icon: Clock,
    variables: ["nomeCliente", "horario", "enderecoImovel"],
    message: `Oi {nomeCliente}! ⏰

Lembrando que sua visita é *hoje às {horario}*.

📍 {enderecoImovel}

Estou te aguardando! Se precisar de ajuda para chegar, me avise.`,
  },
  // Pós-visita
  {
    id: "pos_visita",
    category: "pos_visita",
    title: "Follow-up pós-visita",
    icon: ThumbsUp,
    variables: ["nomeCliente", "nomeImovel"],
    message: `Olá {nomeCliente}! 😊

Foi um prazer te receber na visita ao *{nomeImovel}*. 

O que achou do imóvel? Atendeu suas expectativas?

Caso tenha interesse, posso te apresentar as condições de pagamento e financiamento. Fico à disposição!`,
  },
  {
    id: "pos_visita_negativo",
    category: "pos_visita",
    title: "Pós-visita — imóvel não agradou",
    icon: AlertCircle,
    variables: ["nomeCliente", "nomeCorretor"],
    message: `Oi {nomeCliente}, entendo que o imóvel não atendeu 100% do que você busca.

Isso é normal no processo! Com base no que conversamos, selecionei outras opções que podem ser mais adequadas ao seu perfil.

Posso te enviar? 📱

{nomeCorretor}`,
  },
  // Documentação
  {
    id: "cobrar_documento",
    category: "documentacao",
    title: "Cobrança de documento pendente",
    icon: FileText,
    variables: ["nomeCliente", "documentoPendente"],
    message: `Olá {nomeCliente}! 📋

Para darmos continuidade ao processo, precisamos do seguinte documento:

📄 *{documentoPendente}*

Consegue nos enviar até amanhã? Se tiver dúvidas sobre como obter, estou à disposição para ajudar!`,
  },
  {
    id: "docs_completos",
    category: "documentacao",
    title: "Documentação completa",
    icon: FileText,
    variables: ["nomeCliente"],
    message: `Ótima notícia, {nomeCliente}! ✅

Toda a documentação foi recebida e está em ordem. Já estamos encaminhando para análise.

Te mantenho atualizado(a) sobre o andamento. Qualquer dúvida, estou aqui!`,
  },
  // Negociação
  {
    id: "proposta",
    category: "negociacao",
    title: "Envio de proposta",
    icon: Handshake,
    variables: ["nomeCliente", "nomeImovel", "valorProposta"],
    message: `{nomeCliente}, boa notícia! 🎉

Conseguimos as seguintes condições para o *{nomeImovel}*:

💰 Valor: *{valorProposta}*

Essa é uma condição especial com prazo limitado. Quer que eu formalize a proposta?`,
  },
  {
    id: "contraproposta",
    category: "negociacao",
    title: "Resposta de contraproposta",
    icon: Handshake,
    variables: ["nomeCliente", "novoValor"],
    message: `Oi {nomeCliente}!

Conversei com o proprietário e ele fez uma contraproposta:

💰 Novo valor: *{novoValor}*

Essa é a melhor condição que conseguimos negociar. O que acha? Posso seguir com a proposta?`,
  },
  // Follow-up
  {
    id: "followup_7dias",
    category: "followup",
    title: "Follow-up 7 dias sem retorno",
    icon: Clock,
    variables: ["nomeCliente", "nomeCorretor"],
    message: `Oi {nomeCliente}, tudo bem?

Faz alguns dias que não nos falamos. Você ainda está buscando imóvel?

Se precisar, tenho novas opções que podem te interessar. É só me chamar! 😊

{nomeCorretor}`,
  },
  {
    id: "followup_reativacao",
    category: "followup",
    title: "Reativação de lead frio",
    icon: Star,
    variables: ["nomeCliente", "nomeCorretor", "imobiliaria"],
    message: `Olá {nomeCliente}!

Sou {nomeCorretor} da {imobiliaria}. Há um tempo você buscava um imóvel conosco.

O mercado mudou bastante desde então e temos novas oportunidades incríveis. Posso te mostrar as novidades?

Um abraço! 🏡`,
  },
];

const CATEGORIES = [
  { id: "todos", label: "Todos", icon: MessageSquare },
  { id: "primeiro_contato", label: "1º Contato", icon: UserPlus },
  { id: "agendamento", label: "Agendamento", icon: CalendarCheck },
  { id: "pos_visita", label: "Pós-Visita", icon: ThumbsUp },
  { id: "documentacao", label: "Documentos", icon: FileText },
  { id: "negociacao", label: "Negociação", icon: Handshake },
  { id: "followup", label: "Follow-up", icon: Clock },
];

export function WhatsAppTemplates() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchCategory = category === "todos" || t.category === category;
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [search, category]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada! Cole no WhatsApp.");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Templates WhatsApp</h2>
          <p className="text-xs text-muted-foreground">Mensagens prontas para cada momento do atendimento</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px]">{TEMPLATES.length} templates</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar template..."
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={category === cat.id ? "default" : "outline"}
            size="sm"
            className="shrink-0 gap-1.5 text-xs h-8 rounded-full"
            onClick={() => setCategory(cat.id)}
          >
            <cat.icon className="h-3 w-3" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((template) => (
          <Card key={template.id} className="border-border/50 hover:shadow-md transition-shadow group">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <template.icon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium">{template.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-xs"
                  onClick={() => copyToClipboard(template.message)}
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-line text-muted-foreground leading-relaxed max-h-36 overflow-y-auto">
                {template.message}
              </div>

              {template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.variables.map((v) => (
                    <Badge key={v} variant="secondary" className="text-[9px] font-mono">
                      {`{${v}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum template encontrado.</p>
        </div>
      )}
    </div>
  );
}
