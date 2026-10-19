"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  fileUrl: string;
  children: ReactNode;
};

type State = { error: string | null };

/** Isolates react-pdf crashes so the rest of the reader stays usable. */
export class PdfViewerBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || "PDF viewer crashed" };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-muted-foreground">
            The in-app PDF viewer hit a problem. You can open the file directly
            or continue with chapter text.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={this.props.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button">Open PDF</Button>
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={() => this.setState({ error: null })}
            >
              Retry viewer
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
