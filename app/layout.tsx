import type { Metadata } from "next";
import { ThemeScript } from "@/app/theme-script";
import { ThemeToggle } from "@/app/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prumo Viabilidade",
  description: "Modelagem e simulação financeira de projetos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <ThemeScript />
      </head>
      <body>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <strong>Prumo Viabilidade</strong>
          <ThemeToggle />
        </header>
        <main style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
