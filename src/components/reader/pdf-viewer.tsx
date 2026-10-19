"use client";

import { useState } from "react";
import { ExternalLink, FileText, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PdfViewerProps = {
  fileUrl: string;
  className?: string;
  title?: string;
};

/**
 * Native browser PDF embed — more reliable than react-pdf on Vercel / mobile.
 * Falls back to a clear open-file action if the browser blocks inline PDF.
 */
export function PdfViewer({
  fileUrl,
  className,
  title = "Book PDF",
}: PdfViewerProps) {
  const [failed, setFailed] = useState(false);
  const embedSrc = fileUrl.includes("#")
    ? fileUrl
    : `${fileUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-neutral-50", className)}
      data-testid="pdf-viewer"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 bg-white/95 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-600">
          <FileText className="h-3.5 w-3.5" />
          In-app PDF
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-[12px]"
            onClick={() => {
              setFailed(false);
            }}
            aria-label="Reload PDF"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Reload
          </Button>
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

      <div className="relative min-h-0 flex-1">
        {failed ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Your browser blocked the inline PDF. Open the file in a new tab,
              or switch to chapter text from Tools.
            </p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button">Open PDF</Button>
            </a>
          </div>
        ) : (
          <object
            key={embedSrc}
            data={embedSrc}
            type="application/pdf"
            title={title}
            className="h-full min-h-[calc(100dvh-7rem)] w-full border-0 bg-white"
          >
            <iframe
              title={title}
              src={embedSrc}
              className="h-full min-h-[calc(100dvh-7rem)] w-full border-0 bg-white"
              onError={() => setFailed(true)}
            />
          </object>
        )}
      </div>
    </div>
  );
}
