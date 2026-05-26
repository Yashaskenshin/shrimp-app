import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shrimp Cost Sheet",
  description: "Shrimp export cost-sheet & quotation calculator",
};

function Nav() {
  const items: { href: string; label: string }[] = [
    { href: "/", label: "Dashboard" },
    { href: "/quotes", label: "Quotes" },
    { href: "/quotes/new", label: "New Quote" },
    { href: "/products", label: "Products" },
    { href: "/assumptions", label: "Assumptions" },
  ];
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href="/" className="text-base font-semibold text-slate-900">
          Shrimp Cost Sheet
        </Link>
        <nav className="flex gap-1 text-sm">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <Nav />
        <main className="mx-auto max-w-[min(1680px,calc(100%-2rem))] px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
