import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeScript } from "@/app/theme-script";
import { ThemeToggle } from "@/app/theme-toggle";
import "./globals.css";

// Tipografia da marca Neves Soluções (MY_BUSINESS/brand/brand-identity.md, Seção 4).
const fontDisplay = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700"] });
const fontBody = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const fontMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Prumo Viabilidade",
  description: "Modelagem e simulação financeira de projetos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}>
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
