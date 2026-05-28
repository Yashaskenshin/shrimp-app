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
          <div className="relative mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-base text-white select-none">🦐</span>
              <span className="hidden sm:block">Shrimp Cost Sheet</span>
            </Link>
            <NavLinks />
            <Link href="/quotes/new" className="btn-primary ml-auto hidden py-1.5 text-xs sm:inline-flex">
              + New Quote
            </Link>
          </div>
        </header>
        <ToastProvider>
          <main className="mx-auto max-w-[min(1680px,calc(100%-2rem))] px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
