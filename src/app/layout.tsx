import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-Agent Orchestrator | AI-Powered Development Pipeline",
  description:
    "A multi-agent orchestration system that automatically analyzes requirements, plans tasks, writes code, reviews it, and generates deployment configs using AI agents powered by Groq.",
  keywords: [
    "multi-agent",
    "ai orchestration",
    "code generation",
    "groq",
    "vercel ai sdk",
    "llm pipeline",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
