import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Use CDN worker to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfPageRendererProps {
  pdfUrl: string;
  pageNumber: number; // 0-indexed
  width: number;
  onPageLoaded?: (dims: { width: number; height: number }) => void;
  className?: string;
}

export function PdfPageRenderer({ pdfUrl, pageNumber, width, onPageLoaded, className }: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setError(null);
      try {
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber + 1); // pdf.js uses 1-indexed
        if (cancelled) return;

        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width * 2; // 2x for retina
        canvas.height = viewport.height * 2;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(2, 2);

        await page.render({ canvasContext: ctx, viewport }).promise;
        onPageLoaded?.({ width: viewport.width, height: viewport.height });
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Erro ao renderizar PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (pdfUrl && width > 0) render();
    return () => { cancelled = true; };
  }, [pdfUrl, pageNumber, width]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 bg-destructive/5 rounded-md text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
