"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
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

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Prefer same-origin worker shipped in /public (more reliable on Vercel).
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

type PdfViewerProps = {
  fileUrl: string;
  className?: string;
  title?: string;
};

/**
 * Light in-app PDF reader (react-pdf) — no browser dark chrome / thumbnails.
 */
export function PdfViewer({
  fileUrl,
  className,
  title = "Book PDF",
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.05);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(Math.min(w - 48, 920));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPage(1);
    setError(null);
  }, []);

  const pageWidth = useMemo(
    () => Math.max(280, Math.round(containerWidth * scale)),
    [containerWidth, scale],
  );

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex h-full min-h-0 flex-col bg-neutral-50",
        className,
      )}
      data-testid="pdf-viewer"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 bg-white/95 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={page <= 1}
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
            disabled={!numPages || page >= numPages}
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
            onClick={() => setScale((s) => Math.max(0.7, Number((s - 0.1).toFixed(2))))}
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
            onClick={() => setScale((s) => Math.min(1.8, Number((s + 0.1).toFixed(2))))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Fit width"
            onClick={() => setScale(1)}
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
          <Document
            file={fileUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={() =>
              setError("Could not open this PDF. Try Open file instead.")
            }
            loading={
              <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading PDF…
              </div>
            }
            error={
              <div className="rounded-[1.25rem] border border-neutral-200 bg-white px-5 py-8 text-center text-sm text-foreground">
                {error ?? "Failed to load PDF."}
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={page}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer
              className="overflow-hidden rounded-[0.75rem] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_12px_40px_rgba(0,0,0,0.06)]"
              loading={
                <div className="flex h-[70vh] w-[min(100%,720px)] items-center justify-center rounded-[0.75rem] bg-white text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rendering page…
                </div>
              }
            />
          </Document>
        </div>
      </div>

      <span className="sr-only">{title}</span>
    </div>
  );
}
