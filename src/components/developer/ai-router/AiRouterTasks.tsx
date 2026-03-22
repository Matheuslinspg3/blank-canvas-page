import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, GripVertical, X } from "lucide-react";
import { useAiRouterConfig, type AiRouterTask } from "@/hooks/useAiRouterConfig";
import { useAiRouterProviders } from "@/hooks/useAiRouterProviders";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COMPLEXITY_COLORS: Record<string, string> = {
  simple: "bg-green-500/10 text-green-700",
  medium: "bg-yellow-500/10 text-yellow-700",
  complex: "bg-red-500/10 text-red-700",
  image: "bg-purple-500/10 text-purple-700",
};

function SortableProviderItem({ id, label, isFree, onRemove }: { id: string; label: string; isFree: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-card p-2">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm flex-1">{label}</span>
      {isFree && <Badge variant="secondary" className="text-[10px]">free</Badge>}
      {!isFree && <Badge variant="destructive" className="text-[10px]">pago</Badge>}
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TaskEditModal({
  task,
  open,
  onClose,
  onSave,
  isNew,
}: {
  task: Partial<AiRouterTask>;
  open: boolean;
  onClose: () => void;
  onSave: (t: Partial<AiRouterTask>) => void;
  isNew: boolean;
}) {
  const { providers } = useAiRouterProviders();
  const [form, setForm] = useState({ ...task });
  const [chain, setChain] = useState<string[]>(task.provider_chain || []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const providerMap = Object.fromEntries(providers.map((p) => [p.provider_key, p]));
  const availableProviders = providers.filter((p) => !chain.includes(p.provider_key));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = chain.indexOf(active.id);
      const newIndex = chain.indexOf(over.id);
      setChain(arrayMove(chain, oldIndex, newIndex));
    }
  };

  const handleSave = () => {
    onSave({
      ...form,
      provider_chain: chain,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo Task Type" : `Editar: ${task.display_name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isNew && (
            <div>
              <Label>Task Type (slug)</Label>
              <Input
                value={form.task_type || ""}
                onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                placeholder="ex: summarize"
              />
            </div>
          )}

          <div>
            <Label>Nome de exibição</Label>
            <Input value={form.display_name || ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <Label>System Prompt</Label>
            <Textarea
              value={form.system_prompt || ""}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Complexidade</Label>
              <Select value={form.complexity || "medium"} onValueChange={(v) => setForm({ ...form, complexity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="complex">Complex</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={form.max_tokens || 2000}
                onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 2000 })}
              />
            </div>
          </div>

          <div>
            <Label>Temperature: {(form.temperature ?? 0.7).toFixed(1)}</Label>
            <Slider
              value={[form.temperature ?? 0.7]}
              onValueChange={([v]) => setForm({ ...form, temperature: v })}
              min={0} max={1} step={0.1}
              className="mt-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.requires_image || false}
              onCheckedChange={(v) => setForm({ ...form, requires_image: !!v })}
            />
            <Label>Requer imagem</Label>
          </div>

          {/* Provider chain */}
          <div>
            <Label className="mb-2 block">Ordem dos Providers</Label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={chain} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {chain.map((key) => (
                    <SortableProviderItem
                      key={key}
                      id={key}
                      label={providerMap[key]?.display_name || key}
                      isFree={providerMap[key]?.is_free ?? true}
                      onRemove={() => setChain(chain.filter((k) => k !== key))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {availableProviders.length > 0 && (
              <Select onValueChange={(v) => setChain([...chain, v])}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="+ Adicionar provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p.provider_key} value={p.provider_key}>
                      {p.display_name} {p.is_free ? "(free)" : "(pago)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AiRouterTasks() {
  const { tasks, isLoading, updateTask, createTask, toggleActive } = useAiRouterConfig();
  const [editingTask, setEditingTask] = useState<Partial<AiRouterTask> | null>(null);
  const [isNew, setIsNew] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSave = (data: Partial<AiRouterTask>) => {
    if (isNew) {
      createTask.mutate(data as any, { onSuccess: () => setEditingTask(null) });
    } else {
      updateTask.mutate({ id: editingTask!.id!, ...data }, { onSuccess: () => setEditingTask(null) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setIsNew(true);
            setEditingTask({ complexity: "medium", max_tokens: 2000, temperature: 0.7, provider_chain: [], is_active: true, requires_image: false });
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Novo Task Type
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">{task.display_name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{task.task_type}</p>
                </div>
                <Badge className={`shrink-0 text-[10px] ${COMPLEXITY_COLORS[task.complexity] || ""}`}>
                  {task.complexity}
                </Badge>
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={task.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: task.id, is_active: v })}
                  />
                  <span className="text-xs text-muted-foreground">{task.is_active ? "Ativo" : "Inativo"}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsNew(false);
                    setEditingTask(task);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSave}
          isNew={isNew}
        />
      )}
    </div>
  );
}
