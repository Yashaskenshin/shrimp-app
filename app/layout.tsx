import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "./components/NavLinks";
import { ToastProvider } from "./components/Toaster";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shrimp Cost Sheet",
  description: "Shrimp export cost-sheet & quotation calculator",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
            <Link href="/" className="shrink-0 text-base font-semibold text-slate-900">
              Shrimp Cost Sheet
            </Link>
            <NavLinks />
          </div>
        </header>
        <ToastProvider>
          <main className="mx-auto max-w-[min(1680px,calc(100%-2rem))] px-6 py-8">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
