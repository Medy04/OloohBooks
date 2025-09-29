"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fromXOFtoEUR } from "@/lib/currency";

export default function Home() {
  const now = new Date();
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());

  function monthRange(y, m) {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function load() {
    setLoading(true);
    try {
      const { start, end } = monthRange(year, month);
      const [salesRes, expRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total_xof, created_at")
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("expenses")
          .select("id, amount_xof, created_at")
          .gte("created_at", start)
          .lt("created_at", end),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (expRes.error) throw expRes.error;
      setSales(salesRes.data || []);
      setExpenses(expRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month, year]);

  // Realtime: refresh KPIs when sales change
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-sales-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => load()
      )
      .subscribe();
    const ch2 = supabase
      .channel("dashboard-expenses-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ch2);
    };
  }, [month, year]);

  const revenueMonthEUR = useMemo(() => {
    const xof = sales.reduce((s, r) => s + Number(r.total_xof || 0), 0);
    return fromXOFtoEUR(xof);
  }, [sales]);
  const expensesMonthEUR = useMemo(() => {
    const xof = expenses.reduce((s, e) => s + Number(e.amount_xof || 0), 0);
    return fromXOFtoEUR(xof);
  }, [expenses]);
  const marginMonthEUR = useMemo(() => revenueMonthEUR - expensesMonthEUR, [revenueMonthEUR, expensesMonthEUR]);

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  const dailySeries = useMemo(() => {
    const days = daysInMonth(year, month);
    const revXof = Array(days).fill(0);
    const expXof = Array(days).fill(0);
    for (const s of sales) {
      const d = new Date(s.created_at).getDate();
      revXof[d - 1] += Number(s.total_xof || 0);
    }
    for (const e of expenses) {
      const d = new Date(e.created_at).getDate();
      expXof[d - 1] += Number(e.amount_xof || 0);
    }
    const rev = revXof.map((v) => fromXOFtoEUR(v));
    const exp = expXof.map((v) => fromXOFtoEUR(v));
    const mar = rev.map((v, i) => v - exp[i]);
    return { rev, exp, mar };
  }, [sales, expenses, month, year]);

  function buildPath(values, width, height, padding) {
    const n = values.length || 1;
    const maxVal = Math.max(1, ...values);
    const w = width - padding * 2;
    const h = height - padding * 2;
    const step = n > 1 ? w / (n - 1) : 0;
    const y = (v) => padding + (h - (v / maxVal) * h);
    const x = (i) => padding + i * step;
    let d = "";
    values.forEach((v, i) => {
      const cmd = i === 0 ? "M" : "L";
      d += `${cmd}${x(i)},${y(v)} `;
    });
    return { d, maxVal };
  }
  const cards = [
    { href: "/products", title: "Produits", desc: "Gérer les articles, variantes, prix et stock." },
    { href: "/sales", title: "Ventes", desc: "Enregistrer une vente, canal, lieu et mode de paiement." },
    { href: "/expenses", title: "Dépenses", desc: "Saisir les dépenses et pièces jointes." },
    { href: "/reports", title: "Rapports", desc: "Chiffre d’affaires, marge, par canal/lieu, exports." },
    { href: "/settings", title: "Paramètres", desc: "Canaux, lieux, TVA, paiements, catégories et rôles." },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Suivez vos ventes et dépenses par canal et par lieu.
        </p>
      </div>
      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/sales" className="px-3 py-2 rounded-md bg-black text-white">Nouvelle vente</Link>
        <Link href="/expenses" className="px-3 py-2 rounded-md border">Nouvelle dépense</Link>
        <Link href="/products" className="px-3 py-2 rounded-md border">Ajouter un produit</Link>
        <button onClick={load} className="px-3 py-2 rounded-md border">Rafraîchir</button>
      </div>
      {/* Période + KPI cards */}
      <div className="flex flex-wrap gap-2 items-center">
        <select className="rounded-md border px-3 py-2 bg-transparent" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
          ))}
        </select>
        <select className="rounded-md border px-3 py-2 bg-transparent" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 7 }, (_, i) => now.getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-neutral-500">Chiffre d’affaires (mois)</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "…" : `${revenueMonthEUR.toFixed(2)} €`}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-neutral-500">Marge (mois)</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "…" : `${marginMonthEUR.toFixed(2)} €`}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-neutral-500">Dépenses (mois)</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "…" : `${expensesMonthEUR.toFixed(2)} €`}</div>
        </div>
      </div>

      {/* Graphique CA / Dépenses / Marge (EUR) */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Évolution mensuelle (EUR)</div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-600"></span> CA</div>
            <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-600"></span> Dépenses</div>
            <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span> Marge</div>
          </div>
        </div>
        {(() => {
          const W = 760, H = 220, P = 24;
          const pRev = buildPath(dailySeries.rev, W, H, P);
          const pExp = buildPath(dailySeries.exp, W, H, P);
          const pMar = buildPath(dailySeries.mar, W, H, P);
          const maxAll = Math.max(pRev.maxVal, pExp.maxVal, pMar.maxVal);
          return (
            <div className="overflow-x-auto">
              <svg width={W} height={H} className="min-w-full">
                {/* axes simples */}
                <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="#ddd" />
                <line x1={P} y1={P} x2={P} y2={H-P} stroke="#ddd" />
                {/* labels max */}
                <text x={P} y={P-6} fontSize="10" fill="#666">max {maxAll.toFixed(2)} €</text>
                <path d={pRev.d} fill="none" stroke="#059669" strokeWidth="2" />
                <path d={pExp.d} fill="none" stroke="#e11d48" strokeWidth="2" />
                <path d={pMar.d} fill="none" stroke="#2563eb" strokeWidth="2" />
              </svg>
            </div>
          );
        })()}
        {/* Récap gains / pertes */}
        {(() => {
          const gains = dailySeries.mar.filter(v => v > 0).reduce((s,v)=>s+v,0);
          const pertes = dailySeries.mar.filter(v => v < 0).reduce((s,v)=>s+v,0);
          const gainDays = dailySeries.mar.filter(v => v > 0).length;
          const lossDays = dailySeries.mar.filter(v => v < 0).length;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-3"><div className="text-neutral-500">Jours de gain</div><div className="font-medium">{gainDays}</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Jours de perte</div><div className="font-medium">{lossDays}</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Total gains (EUR)</div><div className="font-medium text-emerald-700">{gains.toFixed(2)} €</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Total pertes (EUR)</div><div className="font-medium text-rose-700">{Math.abs(pertes).toFixed(2)} €</div></div>
            </div>
          );
        })()}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-sm transition"
          >
            <div className="text-lg font-medium">{c.title}</div>
            <div className="text-sm text-neutral-500 mt-1">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
