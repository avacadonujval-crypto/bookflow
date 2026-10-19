"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PdfViewerProps = {
  fileUrl: string;
  className?: string;
  title?: string;
};

/**
 * Client-only pdf.js canvas viewer (light UI).
 * Avoids react-pdf SSR crashes and Chrome-embed quirks.
 */
export function PdfViewer({
  fileUrl,
  className,
  title = "Book PDF",
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    setNumPages(0);
    pdfRef.current = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({
          url: fileUrl,
          withCredentials: false,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          void pdf.cleanup();
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error("[BookFlow] PDF load failed", err);
        if (!cancelled) {
          setError("Could not render this PDF in-app. Open the file instead.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      void pdfRef.current?.cleanup();
      pdfRef.current = null;
    };
  }, [fileUrl]);

  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || page < 1) return;

    try {
      const pdfPage = await pdf.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const context = canvas.getContext("2d");
      if (!context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      await pdfPage.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise;
    } catch (err) {
      console.error("[BookFlow] PDF page render failed", err);
      setError("Could not render this page. Try Open file.");
    }
  }, [page, scale]);

  useEffect(() => {
    if (!loading && !error && numPages > 0) {
      void renderPage();
    }
  }, [loading, error, numPages, renderPage]);

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-neutral-100", className)}
      data-testid="pdf-viewer"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 bg-white/95 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={page <= 1 || loading}
            aria-label="Previous page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4.5rem] text-center text-[12px] tabular-nums text-neutral-600">
            {numPages ? `${page} / ${numPages}` : "—"}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={!numPages || page >= numPages || loading}
            aria-label="Next page"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-1 h-4 w-px bg-neutral-200" aria-hidden />

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Zoom out"
            onClick={() =>
              setScale((s) => Math.max(0.7, Number((s - 0.1).toFixed(2))))
            }
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-[12px] tabular-nums text-neutral-600">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Zoom in"
            onClick={() =>
              setScale((s) => Math.min(2, Number((s + 0.1).toFixed(2))))
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Reset zoom"
            onClick={() => setScale(1.15)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="ml-auto">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-foreground"
          >
            Open file
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex min-h-full justify-center px-4 py-6">
          {loading ? (
            <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading PDF…
            </div>
          ) : error ? (
            <div className="flex max-w-md flex-col items-center gap-4 rounded-[1.25rem] border border-neutral-200 bg-white px-5 py-8 text-center">
              <p className="text-sm text-foreground">{error}</p>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button">Open PDF</Button>
              </a>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="max-w-full rounded-[0.75rem] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_12px_40px_rgba(0,0,0,0.08)]"
              aria-label={title}
            />
          )}
        </div>
      </div>
    </div>
  );
}
