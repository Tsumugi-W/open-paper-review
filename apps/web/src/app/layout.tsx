import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenPaperReview",
  description: "AI-powered academic paper review system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] min-h-screen antialiased">
        <div className="flex min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
