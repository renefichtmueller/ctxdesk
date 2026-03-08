import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/components/providers/language-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CtxDesk",
  description: "Persönliches Projektmanagement mit Claude Code Integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "#0f172a", color: "#f8fafc" }}
      >
        <LanguageProvider>
          {children}
        </LanguageProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0e1528",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              color: "#f8fafc",
            },
          }}
        />
      </body>
    </html>
  );
}
