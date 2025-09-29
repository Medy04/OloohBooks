"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
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
  // Helper to format euros
  function fmtEUR(n) {
    return `${n.toFixed(2)} €`;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = monthRange(year, month);
      const [salesRes, expRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, qty, total_xof, location, created_at, products(name, ref)")
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
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

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

  const top5Products = useMemo(() => {
    const qtyByProduct = new Map();
    for (const s of sales) {
      const name = s.products?.name || "—";
      qtyByProduct.set(name, (qtyByProduct.get(name) || 0) + Number(s.qty || 0));
    }
    return Array.from(qtyByProduct.entries())
      .sort((a,b) => b[1] - a[1])
      .slice(0,5);
  }, [sales]);

  const paymentBreakdown = useMemo(() => {
    const cnt = new Map();
    for (const s of sales) {
      const m = s.payment_method || "—";
      cnt.set(m, (cnt.get(m) || 0) + 1);
    }
    const arr = Array.from(cnt.entries()).sort((a,b) => b[1] - a[1]);
    const max = arr.length ? arr[0][1] : 1;
    return { arr, max };
  }, [sales]);

  const salesCountByLocation = useMemo(() => {
    const cnt = new Map();
    for (const s of sales) {
      const loc = s.location || "—";
      cnt.set(loc, (cnt.get(loc) || 0) + 1);
    }
    const arr = Array.from(cnt.entries()).sort((a,b) => b[1] - a[1]);
    const max = arr.length ? arr[0][1] : 1;
    return { arr, max };
  }, [sales]);
  const expensesMonthEUR = useMemo(() => {
    const xof = expenses.reduce((s, e) => s + Number(e.amount_xof || 0), 0);
    return fromXOFtoEUR(xof);
  }, [expenses]);
  const marginMonthEUR = useMemo(() => revenueMonthEUR - expensesMonthEUR, [revenueMonthEUR, expensesMonthEUR]);
  const [hoverI, setHoverI] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, show: false });

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
    const labels = Array.from({ length: days }, (_, i) => i + 1);
    return { rev, exp, mar, labels };
  }, [sales, expenses, month, year]);

  // Aggregates for stats: top product, CA by location, best/worst location
  const byLocation = useMemo(() => {
    const map = new Map();
    for (const r of sales) {
      const k = r.location || "—";
      map.set(k, (map.get(k) || 0) + Number(r.total_xof || 0));
    }
    return Array.from(map.entries()).map(([loc, xof]) => [loc, fromXOFtoEUR(xof)]);
  }, [sales]);

  const topProduct = useMemo(() => {
    const qtyByProduct = new Map();
    for (const s of sales) {
      const name = s.products?.name || "—";
      qtyByProduct.set(name, (qtyByProduct.get(name) || 0) + Number(s.qty || 0));
    }
    let best = ["—", 0];
    for (const [name, q] of qtyByProduct.entries()) {
      if (q > best[1]) best = [name, q];
    }
    return best;
  }, [sales]);

  const prolificLocations = useMemo(() => {
    if (sales.length === 0) return { best: ["—", 0], worst: ["—", 0] };
    const xofByLoc = new Map();
    for (const s of sales) {
      const loc = s.location || "—";
      xofByLoc.set(loc, (xofByLoc.get(loc) || 0) + Number(s.total_xof || 0));
    }
    const arr = Array.from(xofByLoc.entries());
    arr.sort((a,b) => b[1] - a[1]);
    const best = arr[0];
    const worst = arr[arr.length - 1];
    return { best: [best[0], fromXOFtoEUR(best[1])], worst: [worst[0], fromXOFtoEUR(worst[1])] };
  }, [sales]);

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
      <div className="rounded-md border bg-neutral-50 dark:bg-neutral-950 p-3 text-sm">
        <span className="font-medium">Bonjour OloohBooks admin</span>, bienvenue sur la plateforme de gestion comptable de Olooh.
      </div>
      {/* En-tête + actions rapides */}
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-neutral-500 mt-1">Suivez vos ventes et dépenses par canal et par lieu.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/sales" className="px-3 py-2 rounded-md border border-[#C5A029] bg-[#C5A029] text-white hover:bg-[#a78a22]">Nouvelle vente</Link>
        <Link href="/expenses" className="px-3 py-2 rounded-md border">Nouvelle dépense</Link>
        <Link href="/products" className="px-3 py-2 rounded-md border">Ajouter un produit</Link>
        <button onClick={load} className="px-3 py-2 rounded-md border">Rafraîchir</button>
      </div>
      {/* Période */}
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
      {/* Statistiques complémentaires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-2">CA par lieu (EUR)</div>
          {byLocation.length === 0 ? (
            <div className="text-sm text-neutral-500">Aucune vente sur la période.</div>
          ) : (
            <ul className="text-sm space-y-1">
              {byLocation.sort((a,b)=>b[1]-a[1]).map(([loc, eur]) => (
                <li key={loc} className="flex justify-between"><span>{loc}</span><span>{eur.toFixed(2)} €</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-2">Lieux prolifiques</div>
          <div className="text-sm">
            <div><span className="text-neutral-500">Le plus prolifique:</span> <span className="font-medium">{prolificLocations.best[0]}</span> ({fmtEUR(prolificLocations.best[1]||0)})</div>
            <div className="mt-1"><span className="text-neutral-500">Le moins prolifique:</span> <span className="font-medium">{prolificLocations.worst[0]}</span> ({fmtEUR(prolificLocations.worst[1]||0)})</div>
          </div>
          {/* Placeholder top product: requires join on products in dashboard query to be accurate */}
          <div className="mt-3 text-sm"><span className="text-neutral-500">Article le plus vendu:</span> <span className="font-medium">{topProduct[0]}</span> {topProduct[1] ? `(qté ${topProduct[1]})` : ''}</div>
        </div>
      </div>

      {/* Top 5 produits & Répartition moyens de paiement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-2">Top 5 produits (par quantité)</div>
          {top5Products.length === 0 ? (
            <div className="text-sm text-neutral-500">Pas encore de ventes ce mois.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b"><th className="py-1 text-left">Produit</th><th className="py-1 text-right">Qté</th></tr>
              </thead>
              <tbody>
                {top5Products.map(([name, qty]) => (
                  <tr key={name} className="border-b">
                    <td className="py-1">{name}</td>
                    <td className="py-1 text-right">{qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-2">Moyens de paiement (nombre de ventes)</div>
          {paymentBreakdown.arr.length === 0 ? (
            <div className="text-sm text-neutral-500">Pas de ventes sur la période.</div>
          ) : (
            <ul className="text-sm space-y-1">
              {paymentBreakdown.arr.map(([m, c]) => (
                <li key={m} className="flex items-center gap-2">
                  <div className="w-24 text-neutral-600">{m}</div>
                  <div className="flex-1 h-2 rounded bg-neutral-200">
                    <div className="h-2 rounded bg-emerald-600" style={{ width: `${(c / paymentBreakdown.max) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right">{c}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Histogramme: Ventes par lieu (compte) */}
      <div className="rounded-lg border p-4">
        <div className="font-semibold mb-2">Ventes par lieu (nombre)</div>
        {salesCountByLocation.arr.length === 0 ? (
          <div className="text-sm text-neutral-500">Pas de ventes sur la période.</div>
        ) : (
          <ul className="text-sm space-y-1">
            {salesCountByLocation.arr.map(([loc, c]) => (
              <li key={loc} className="flex items-center gap-2">
                <div className="w-32 text-neutral-600">{loc}</div>
                <div className="flex-1 h-2 rounded bg-neutral-200">
                  <div className="h-2 rounded bg-blue-600" style={{ width: `${(c / salesCountByLocation.max) * 100}%` }} />
                </div>
                <div className="w-8 text-right">{c}</div>
              </li>
            ))}
          </ul>
        )}
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
          const W = 760, H = 240, P = 30;
          const pRev = buildPath(dailySeries.rev, W, H, P);
          const pExp = buildPath(dailySeries.exp, W, H, P);
          const pMar = buildPath(dailySeries.mar, W, H, P);
          const maxAll = Math.max(pRev.maxVal, pExp.maxVal, pMar.maxVal);
          const n = dailySeries.labels.length || 1;
          const w = W - P * 2;
          const h = H - P * 2;
          const step = n > 1 ? w / (n - 1) : 0;
          const y = (v) => P + (h - (v / (maxAll || 1)) * h);
          const x = (i) => P + i * step;
          const onMove = (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const i = Math.max(0, Math.min(n - 1, Math.round((localX - P) / (step || 1))));
            setHoverI(i);
            setTooltip({ x: localX + 12, y: 24, show: true });
          };
          const onLeave = () => { setHoverI(null); setTooltip({ x: 0, y: 0, show: false }); };
          const yticks = 4;
          return (
            <div className="relative overflow-x-auto">
              <svg width={W} height={H} className="min-w-full" onMouseMove={onMove} onMouseLeave={onLeave}>
                {/* gridlines */}
                {[...Array(yticks + 1)].map((_, k) => {
                  const gy = P + (h / yticks) * k;
                  const val = (maxAll / yticks) * (yticks - k);
                  return (
                    <g key={k}>
                      <line x1={P} y1={gy} x2={W-P} y2={gy} stroke="#eee" />
                      <text x={P - 6} y={gy + 3} fontSize="10" fill="#666" textAnchor="end">{val.toFixed(0)}</text>
                    </g>
                  );
                })}
                {/* x axis */}
                <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="#ddd" />
                <line x1={P} y1={P} x2={P} y2={H-P} stroke="#ddd" />
                {/* x ticks every 5 days */}
                {dailySeries.labels.map((d, i) => (i % 5 === 0 || i === n-1) && (
                  <g key={i}>
                    <line x1={x(i)} y1={H-P} x2={x(i)} y2={H-P+4} stroke="#bbb" />
                    <text x={x(i)} y={H-P+14} fontSize="10" fill="#666" textAnchor="middle">{d}</text>
                  </g>
                ))}
                {/* series */}
                <path d={pRev.d} fill="none" stroke="#059669" strokeWidth="2" />
                <path d={pExp.d} fill="none" stroke="#e11d48" strokeWidth="2" />
                <path d={pMar.d} fill="none" stroke="#2563eb" strokeWidth="2" />
                {/* hover guide and points */}
                {hoverI != null && (
                  <g>
                    <line x1={x(hoverI)} y1={P} x2={x(hoverI)} y2={H-P} stroke="#999" strokeDasharray="4 4" />
                    <circle cx={x(hoverI)} cy={y(dailySeries.rev[hoverI])} r="3" fill="#059669" />
                    <circle cx={x(hoverI)} cy={y(dailySeries.exp[hoverI])} r="3" fill="#e11d48" />
                    <circle cx={x(hoverI)} cy={y(dailySeries.mar[hoverI])} r="3" fill="#2563eb" />
                  </g>
                )}
              </svg>
              {/* tooltip */}
              {tooltip.show && hoverI != null && (
                <div className="absolute text-xs rounded-md border bg-white shadow px-2 py-1" style={{ left: tooltip.x, top: tooltip.y }}>
                  <div className="font-medium">Jour {dailySeries.labels[hoverI]}</div>
                  <div className="text-emerald-700">CA: {fmtEUR(dailySeries.rev[hoverI])}</div>
                  <div className="text-rose-700">Dépenses: {fmtEUR(dailySeries.exp[hoverI])}</div>
                  <div className="text-blue-700">Marge: {fmtEUR(dailySeries.mar[hoverI])}</div>
                </div>
              )}
            </div>
          );
        })()}
        {/* Récap gains / pertes */}
        {(() => {
          const gains = dailySeries.mar.filter(v => v > 0).reduce((s,v)=>s+v,0);
          const pertes = dailySeries.mar.filter(v => v < 0).reduce((s,v)=>s+v,0);
          const gainDays = dailySeries.mar.filter(v => v > 0).length;
          const lossDays = dailySeries.mar.filter(v => v < 0).length;
          const n = dailySeries.labels.length || 1;
          const avgMargin = (gains + pertes) / n;
          const bestIdx = dailySeries.mar.reduce((bi, v, i) => v > dailySeries.mar[bi] ? i : bi, 0);
          const worstIdx = dailySeries.mar.reduce((wi, v, i) => v < dailySeries.mar[wi] ? i : wi, 0);
          return (
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-sm">
              <div className="rounded border p-3"><div className="text-neutral-500">Jours de gain</div><div className="font-medium">{gainDays}</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Jours de perte</div><div className="font-medium">{lossDays}</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Total gains (EUR)</div><div className="font-medium text-emerald-700">{gains.toFixed(2)} €</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Total pertes (EUR)</div><div className="font-medium text-rose-700">{Math.abs(pertes).toFixed(2)} €</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Marge moyenne</div><div className="font-medium">{avgMargin.toFixed(2)} €</div></div>
              <div className="rounded border p-3"><div className="text-neutral-500">Meilleur/Pire jour</div><div className="font-medium">J{dailySeries.labels[bestIdx]} ({fmtEUR(dailySeries.mar[bestIdx])}) / J{dailySeries.labels[worstIdx]} ({fmtEUR(dailySeries.mar[worstIdx])})</div></div>
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
