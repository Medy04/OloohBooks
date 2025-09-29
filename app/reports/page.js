"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fromXOFtoEUR } from "@/lib/currency";

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());
  const [location, setLocation] = useState(""); // all if empty
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  function monthRange(y, m) {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function load() {
    setLoading(true);
    try {
      const { start, end } = monthRange(year, month);
      let salesQuery = supabase
        .from("sales")
        .select("id, qty, total_xof, location, payment_method, created_at, products(name, ref)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });
      if (location) salesQuery = salesQuery.eq("location", location);
      const [salesRes, expRes] = await Promise.all([
        salesQuery,
        supabase
          .from("expenses")
          .select("id, amount_xof, location, category, created_at")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false }),
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
  }, [month, year, location]);

  // Realtime: refresh on sales changes
  useEffect(() => {
    const channel = supabase
      .channel("reports-sales-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => load()
      )
      .subscribe();
    const ch2 = supabase
      .channel("reports-expenses-rt")
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
  }, [month, year, location]);

  const totalRevenueEUR = useMemo(() => fromXOFtoEUR(sales.reduce((s, r) => s + Number(r.total_xof || 0), 0)), [sales]);
  const totalExpensesEUR = useMemo(() => fromXOFtoEUR(expenses.reduce((s, e) => s + Number(e.amount_xof || 0), 0)), [expenses]);
  const marginEUR = useMemo(() => totalRevenueEUR - totalExpensesEUR, [totalRevenueEUR, totalExpensesEUR]);
  const byLocation = useMemo(() => {
    const map = new Map();
    for (const r of sales) {
      const k = r.location || "—";
      map.set(k, (map.get(k) || 0) + Number(r.total_xof || 0));
    }
    // convert to EUR for display
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
    return best; // [name, qty]
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

  const paymentUsage = useMemo(() => {
    const cnt = new Map();
    for (const s of sales) {
      const m = s.payment_method || "—";
      cnt.set(m, (cnt.get(m) || 0) + 1);
    }
    let best = ["—", 0];
    for (const [m, c] of cnt.entries()) {
      if (c > best[1]) best = [m, c];
    }
    return best; // [method, count]
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

  // Export helpers
  function download(filename, text, type = "text/csv;charset=utf-8;") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCSV(rows) {
    return rows.map((r) => r.map((c) => {
      const v = c == null ? "" : String(c);
      if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(",")).join("\n");
  }

  function exportCombinedCSV() {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const headers = [[
      "date","type","description","product_ref","location","payment_method",
      "credit_eur","debit_eur","credit_xof","debit_xof"
    ]];
    // Summary rows first (uniform columns)
    const summaryRows = [
      [
        `${ym}-01`,
        "SUMMARY_CA",
        "Chiffre d'affaires (EUR/XOF)",
        "",
        "",
        "",
        totalRevenueEUR.toFixed(2),
        "0.00",
        // Convert back EUR->XOF for summary credit_xof using peg
        (totalRevenueEUR * 655.957).toFixed(2),
        "0.00",
      ],
      [
        `${ym}-01`,
        "SUMMARY_DEPENSES",
        "Dépenses (EUR/XOF)",
        "",
        "",
        "",
        "0.00",
        totalExpensesEUR.toFixed(2),
        "0.00",
        (totalExpensesEUR * 655.957).toFixed(2),
      ],
      [
        `${ym}-01`,
        "SUMMARY_MARGE",
        "Marge (EUR/XOF)",
        "",
        "",
        "",
        (marginEUR >= 0 ? marginEUR.toFixed(2) : "0.00"),
        (marginEUR < 0 ? Math.abs(marginEUR).toFixed(2) : "0.00"),
        (marginEUR >= 0 ? (marginEUR * 655.957).toFixed(2) : "0.00"),
        (marginEUR < 0 ? (Math.abs(marginEUR) * 655.957).toFixed(2) : "0.00"),
      ],
      // Top product
      [
        `${ym}-01`,
        "SUMMARY_TOP_PRODUCT",
        `Article le plus vendu: ${topProduct[0]} (qté: ${topProduct[1]})`,
        "",
        "",
        "",
        "0.00","0.00","0.00","0.00"
      ],
      // Most used payment method
      [
        `${ym}-01`,
        "SUMMARY_TOP_PAYMENT",
        `Moyen de paiement le plus utilisé: ${paymentUsage[0]} (nb: ${paymentUsage[1]})`,
        "",
        "",
        "",
        "0.00","0.00","0.00","0.00"
      ],
      // Best/Worst locations
      [
        `${ym}-01`,
        "SUMMARY_BEST_LOCATION",
        `Lieu le plus prolifique: ${prolificLocations.best[0]} (${prolificLocations.best[1].toFixed(2)} €)`,
        "",
        "",
        "",
        "0.00","0.00","0.00","0.00"
      ],
      [
        `${ym}-01`,
        "SUMMARY_WORST_LOCATION",
        `Lieu le moins prolifique: ${prolificLocations.worst[0]} (${prolificLocations.worst[1].toFixed(2)} €)`,
        "",
        "",
        "",
        "0.00","0.00","0.00","0.00"
      ],
      // Top 5 produits (summary rows only for visibility)
      ...top5Products.map(([name, qty], i) => [
        `${ym}-01`,
        `SUMMARY_TOP5_PRODUCT_${i+1}`,
        `${name}`,
        "",
        "",
        "",
        "0.00","0.00","0.00","0.00"
      ]),
      // CA par lieu
      ...byLocation.map(([loc, eur]) => [
        `${ym}-01`,
        "SUMMARY_CA_BY_LOCATION",
        `CA ${loc}`,
        "",
        loc,
        "",
        eur.toFixed(2),
        "0.00",
        (eur * 655.957).toFixed(2),
        "0.00",
      ]),
    ];
    const saleRows = sales.map((s) => [
      new Date(s.created_at).toISOString(),
      "SALE",
      s.products?.name || "Vente",
      s.products?.ref || "",
      s.location || "",
      s.payment_method || "",
      fromXOFtoEUR(s.total_xof || 0).toFixed(2),
      "0.00",
      Number(s.total_xof || 0).toFixed(2),
      "0.00",
    ]);
    const expenseRows = expenses.map((e) => [
      new Date(e.created_at).toISOString(),
      "EXPENSE",
      e.title || "",
      "",
      e.location || "",
      "",
      "0.00",
      fromXOFtoEUR(e.amount_xof || 0).toFixed(2),
      "0.00",
      Number(e.amount_xof || 0).toFixed(2),
    ]);
    download(`export_combine_${ym}.csv`, toCSV([...headers, ...summaryRows, ...saleRows, ...expenseRows]));
  }

  function exportPDF() {
    const ym = `${String(month).padStart(2, "0")}/${year}`;
    const win = window.open("", "_blank");
    if (!win) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rapport ${ym}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:16px}
      h1{display:flex;align-items:center;gap:8px;margin:0 0 12px 0}
      h2{margin:16px 0 8px 0}
      .brand{display:flex;align-items:center;gap:10px}
      .brand img{height:28px;width:28px;object-fit:contain}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#f5f5f5}
    </style>
    </head><body>
    <div class="brand"><img src="/logo.png" alt="OloohBooks" /><h1>OloohBooks • Rapport ${ym}</h1></div>
    <h2>KPIs (${ym})</h2>
    <ul>
      <li>CA (EUR): <strong>${totalRevenueEUR.toFixed(2)} €</strong></li>
      <li>Dépenses (EUR): <strong>${totalExpensesEUR.toFixed(2)} €</strong></li>
      <li>Marge (EUR): <strong>${marginEUR.toFixed(2)} €</strong></li>
    </ul>
    <h2>Indicateurs complémentaires</h2>
    <ul>
      <li>Article le plus vendu: <strong>${topProduct[0]}</strong> (qté ${topProduct[1]})</li>
      <li>Moyen de paiement le plus utilisé: <strong>${paymentUsage[0]}</strong> (${paymentUsage[1]})</li>
      <li>Lieu le plus prolifique: <strong>${prolificLocations.best[0]}</strong> (${prolificLocations.best[1].toFixed(2)} €)</li>
      <li>Lieu le moins prolifique: <strong>${prolificLocations.worst[0]}</strong> (${prolificLocations.worst[1].toFixed(2)} €)</li>
    </ul>

    <h2>Top 5 produits (par quantité)</h2>
    <table><thead><tr><th>Produit</th><th>Quantité</th></tr></thead><tbody>
    ${top5Products.map(([name, qty]) => `<tr><td>${name}</td><td>${qty}</td></tr>`).join("")}
    </tbody></table>

    <h2>CA par lieu (EUR)</h2>
    <table><thead><tr><th>Lieu</th><th>CA (EUR)</th></tr></thead><tbody>
    ${byLocation.map(([loc, val]) => `<tr><td>${loc}</td><td>${val.toFixed(2)} €</td></tr>`).join("")}
    </tbody></table>

    <h2>Ventes (${ym})</h2>
    <table><thead><tr><th>Date</th><th>Produit</th><th>Ref</th><th>Lieu</th><th>Paiement</th><th>Total (EUR)</th></tr></thead><tbody>
    ${sales.map(s => `<tr>
      <td>${new Date(s.created_at).toLocaleString()}</td>
      <td>${s.products?.name || ""}</td>
      <td>${s.products?.ref || ""}</td>
      <td>${s.location || ""}</td>
      <td>${s.payment_method || ""}</td>
      <td>${fromXOFtoEUR(s.total_xof || 0).toFixed(2)} €</td>
    </tr>`).join("")}
    </tbody></table>

    <h2>Dépenses (${ym})</h2>
    <table><thead><tr><th>Date</th><th>Lieu</th><th>Catégorie</th><th>Montant (EUR)</th></tr></thead><tbody>
    ${expenses.map(e => `<tr>
      <td>${new Date(e.created_at).toLocaleString()}</td>
      <td>${e.location || ""}</td>
      <td>${e.category || ""}</td>
      <td>${fromXOFtoEUR(e.amount_xof || 0).toFixed(2)} €</td>
    </tr>`).join("")}
    </tbody></table>

    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  function exportAccounting() {
    // Combined accounting CSV (sales + expenses) similar to exportCombinedCSV
    exportCombinedCSV();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Rapports</h1>
        <p className="text-sm text-neutral-500">CA, dépenses, bénéfices. Filtres par période, canal, lieu. Exports CSV/PDF et export comptable (OHADA).</p>
      </div>
      {/* Filtres & Exports */}
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
        <select className="rounded-md border px-3 py-2 bg-transparent" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">Tous lieux</option>
          <option>Abidjan</option>
          <option>Paris</option>
          <option>En ligne</option>
        </select>
        <div className="flex-1" />
        <button className="px-3 py-2 rounded-md border" onClick={exportCombinedCSV}>Exporter CSV</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportPDF}>Exporter PDF</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportAccounting}>Export comptable</button>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-neutral-500">Chiffre d’affaires (EUR)</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "…" : `${totalRevenueEUR.toFixed(2)} €`}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-neutral-500">Dépenses (EUR)</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "…" : `${totalExpensesEUR.toFixed(2)} €`}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-neutral-500">Marge (EUR)</div>
          <div className="text-2xl font-semibold mt-1">{loading ? "…" : `${marginEUR.toFixed(2)} €`}</div>
        </div>
      </div>
      {/* CA par lieu */}
      <div className="rounded-lg border p-4">
        <div className="font-medium mb-2">CA par lieu</div>
        {loading ? (
          <div className="text-sm text-neutral-500">Chargement…</div>
        ) : byLocation.length === 0 ? (
          <div className="text-sm">Aucune donnée.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byLocation.map(([loc, val]) => (
              <div key={loc} className="rounded border p-3 flex items-center justify-between">
                <div>{loc}</div>
                <div className="font-medium">{val.toFixed(2)} €</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
