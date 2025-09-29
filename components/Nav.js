"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  // Hide navigation on the login page
  if (pathname === "/login") {
    return null;
  }

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    router.replace("/login");
  }
  return (
    <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-black/40 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="OloohBooks" width={24} height={24} />
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
                    "px-2 py-1 rounded-md transition-colors " +
                    (active
                      ? "text-[#DAA520] border-b-2 border-[#DAA520] font-medium"
                      : "hover:text-[#DAA520]")
                  }
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex-1" />
        <button
          onClick={logout}
          className="text-sm px-3 py-1.5 rounded-md border border-[#C5A029] bg-[#C5A029] text-white hover:bg-[#a78a22]"
        >
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}
