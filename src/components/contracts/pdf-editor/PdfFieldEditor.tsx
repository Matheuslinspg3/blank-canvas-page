import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, ChevronLeft, ChevronRight, Sparkles, Trash2, Search } from "lucide-react";
import { PdfPageRenderer } from "./PdfPageRenderer";
import { DraggableField } from "./DraggableField";
import { AVAILABLE_PDF_FIELDS, type PdfFieldPosition } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

interface PdfFieldEditorProps {
  pdfUrl: string | null;
  onPdfUploaded: (url: string) => void;
  fieldPositions: PdfFieldPosition[];
  onFieldPositionsChange: (positions: PdfFieldPosition[]) => void;
}

export function PdfFieldEditor({ pdfUrl, onPdfUploaded, fieldPositions, onFieldPositionsChange }: PdfFieldEditorProps) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [fieldSearch, setFieldSearch] = useState("");
  const [aiDetecting, setAiDetecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get total pages
  useEffect(() => {
    if (!pdfUrl) return;
    pdfjsLib.getDocument(pdfUrl).promise.then(pdf => setTotalPages(pdf.numPages)).catch(() => {});
  }, [pdfUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.organization_id) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB");
      return;
    }

    setUploading(true);
    try {
      const path = `${profile.organization_id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("contract-templates").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
        .from("contract-templates")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year signed URL
      if (signedUrlErr || !signedUrlData?.signedUrl) throw signedUrlErr || new Error("Failed to create signed URL");
      onPdfUploaded(signedUrlData.signedUrl);
      onFieldPositionsChange([]);
      setCurrentPage(0);
      toast.success("PDF enviado com sucesso!");
    } catch (err: any) {
      toastError("Erro ao enviar PDF", err, { module: "PdfFieldEditor" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addField = useCallback((variable: string, label: string) => {
    const newField: PdfFieldPosition = {
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      variable,
      label,
      page: currentPage,
      x: 10,
      y: 10,
      width: 20,
      height: 3,
      fontSize: 10,
    };
    onFieldPositionsChange([...fieldPositions, newField]);
    setSelectedFieldId(newField.id);
  }, [currentPage, fieldPositions, onFieldPositionsChange]);

  const updateField = useCallback((id: string, updates: Partial<PdfFieldPosition>) => {
    onFieldPositionsChange(fieldPositions.map(f => f.id === id ? { ...f, ...updates } : f));
  }, [fieldPositions, onFieldPositionsChange]);

  const removeField = useCallback((id: string) => {
    onFieldPositionsChange(fieldPositions.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }, [fieldPositions, onFieldPositionsChange, selectedFieldId]);

  const currentPageFields = fieldPositions.filter(f => f.page === currentPage);
  const selectedField = fieldPositions.find(f => f.id === selectedFieldId);

  // Group available fields by category
  const filteredFields = AVAILABLE_PDF_FIELDS.filter(f =>
    !fieldSearch || f.label.toLowerCase().includes(fieldSearch.toLowerCase()) || f.variable.includes(fieldSearch.toLowerCase())
  );
  const categories = [...new Set(filteredFields.map(f => f.category))];

  const handleAiDetect = async () => {
    if (!pdfUrl) return;
    setAiDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-pdf-fields", {
        body: { pdfUrl, totalPages },
      });
      if (error) throw error;
      if (data?.fields?.length > 0) {
        onFieldPositionsChange(data.fields);
        toast.success(`${data.fields.length} campos detectados pela IA!`);
      } else {
        toast.info("A IA não detectou campos automaticamente. Posicione manualmente.");
      }
    } catch (err: any) {
      toastError("Erro na detecção de campos", err, { module: "PdfFieldEditor" });
    } finally {
      setAiDetecting(false);
    }
  };

  if (!pdfUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-12 text-center hover:border-primary/50 transition-colors">
          <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Envie um PDF de contrato para posicionar os campos
          </p>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? "Enviando..." : "Enviar PDF"}
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0">
      {/* Left: PDF viewer with fields */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Trocar PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleAiDetect} disabled={aiDetecting} className="gap-1.5 text-xs">
              {aiDetecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              IA Detectar Campos
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[60px] text-center">
              {currentPage + 1} / {totalPages || "?"}
            </span>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF canvas + fields overlay */}
        <div className="flex-1 overflow-auto bg-muted/20 flex justify-center p-4">
          <div ref={containerRef} className="relative inline-block" onClick={() => setSelectedFieldId(null)}>
            <PdfPageRenderer
              pdfUrl={pdfUrl}
              pageNumber={currentPage}
              width={600}
              onPageLoaded={setPageDims}
            />
            {/* Field overlays */}
            {currentPageFields.map(field => (
              <DraggableField
                key={field.id}
                field={field}
                containerWidth={pageDims.width}
                containerHeight={pageDims.height}
                selected={selectedFieldId === field.id}
                onSelect={() => setSelectedFieldId(field.id)}
                onMove={(x, y) => updateField(field.id, { x, y })}
                onResize={(w, h) => updateField(field.id, { width: w, height: h })}
                onRemove={() => removeField(field.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: Field panel */}
      <div className="w-64 border-l flex flex-col shrink-0 bg-background">
        {/* Selected field properties */}
        {selectedField && (
          <div className="p-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Propriedades</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeField(selectedField.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Tamanho da fonte</Label>
                <Input
                  type="number"
                  min={6}
                  max={48}
                  value={selectedField.fontSize}
                  onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) || 10 })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Largura (%)</Label>
                  <Input
                    type="number"
                    min={3}
                    max={90}
                    value={Math.round(selectedField.width)}
                    onChange={(e) => updateField(selectedField.id, { width: parseInt(e.target.value) || 20 })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Altura (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={Math.round(selectedField.height)}
                    onChange={(e) => updateField(selectedField.id, { height: parseInt(e.target.value) || 3 })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Available fields */}
        <div className="p-3 pb-2 shrink-0">
          <span className="text-xs font-semibold">Campos disponíveis</span>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar campo..."
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="h-7 text-xs pl-7"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-3 pb-3 space-y-3">
            {categories.map(cat => (
              <div key={cat}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{cat}</span>
                <div className="mt-1 space-y-0.5">
                  {filteredFields.filter(f => f.category === cat).map(f => {
                    const isPlaced = fieldPositions.some(fp => fp.variable === f.variable);
                    return (
                      <button
                        key={f.variable}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2",
                          isPlaced
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-foreground"
                        )}
                        onClick={() => addField(f.variable, f.label)}
                      >
                        <span className="flex-1 truncate">{f.label}</span>
                        {isPlaced && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Pág {(fieldPositions.find(fp => fp.variable === f.variable)?.page ?? 0) + 1}</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Stats */}
        <div className="p-3 border-t text-center">
          <span className="text-[10px] text-muted-foreground">
            {fieldPositions.length} campo{fieldPositions.length !== 1 ? "s" : ""} posicionado{fieldPositions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
    </div>
  );
}
