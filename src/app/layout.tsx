import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BookFlow",
    template: "%s · BookFlow",
  },
  description:
    "Publish, assign, and learn from interactive digital books with analytics and AI-assisted workflows.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="type-medium min-h-full bg-background font-sans text-foreground">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
