"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/quotes", label: "Quotes", exact: true },
  { href: "/products", label: "Products", exact: false },
  { href: "/assumptions", label: "Assumptions", exact: false },
];

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string, exact: boolean) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return clsx(
      "rounded px-3 py-1.5 font-medium transition-colors text-sm",
      active
        ? "bg-emerald-50 text-emerald-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    );
  };

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 sm:flex">
        {NAV.map(({ href, label, exact }) => (
          <Link key={href} href={href} className={linkClass(href, exact)}>
            {label}
          </Link>
        ))}
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        className="ml-auto flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 sm:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        <span className="sr-only">Menu</span>
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="2" x2="16" y2="16" />
            <line x1="16" y1="2" x2="2" y2="16" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="4" x2="16" y2="4" />
            <line x1="2" y1="9" x2="16" y2="9" />
            <line x1="2" y1="14" x2="16" y2="14" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-slate-200 bg-white px-4 py-2 shadow-md sm:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label, exact }) => (
              <Link
                key={href}
                href={href}
                className={linkClass(href, exact)}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <Link href="/quotes/new" className="rounded px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50" onClick={() => setOpen(false)}>
              + New Quote
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
