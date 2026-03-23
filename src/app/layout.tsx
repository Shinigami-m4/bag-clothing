// src/app/layout.tsx
import { Suspense } from "react";
import "./globals.css";
import Shell from "./components/Shell";
import NewsletterGate from "./components/NewsletterGate";

/**
 * RootLayout
 * ------------------------------------------------------------------
 * Global layout (App Router).
 *
 * We mount NewsletterGate at the top level so it can open a native
 * <dialog> modal on first load (or via ?gate=1), independent of Shell.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Newsletter modal (native <dialog>) */}
        <NewsletterGate />

        {/* Main site shell */}
        <Suspense fallback={<div className="shell"><main className="main">{children}</main></div>}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
