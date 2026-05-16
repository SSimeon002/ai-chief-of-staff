import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Chief of Staff",
  description:
    "Triage, flags, and a daily briefing from the CEO's morning inbox.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-50 font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
