"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Produits" },
  { href: "/sales", label: "Ventes" },
  { href: "/expenses", label: "Dépenses" },
  { href: "/reports", label: "Rapports" },
  { href: "/settings", label: "Paramètres" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-black/40 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="OloohBooks" className="h-6 w-6 object-contain" />
          <div className="font-semibold">OloohBooks</div>
        </Link>
        <ul className="flex items-center gap-4 text-sm">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={
                    "px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 " +
                    (active ? "bg-neutral-100 dark:bg-neutral-900 font-medium" : "")
                  }
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
