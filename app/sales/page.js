"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LOCATIONS, PAYMENT_METHODS, CURRENCIES } from "@/lib/constants";
import { toEUR, fromXOFtoEUR } from "@/lib/currency";

export default function SalesPage() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());

  // Form fields
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [location, setLocation] = useState("Abidjan");
  const [payment, setPayment] = useState("Espèces");
  const [currency, setCurrency] = useState("XOF");
  const selectedProduct = products.find((p) => p.id === productId) || null;
  const unitPrice = selectedProduct ? Number(selectedProduct.price || 0) : 0;
  const total = unitPrice * Number(qty || 0);
  const totalEUR = useMemo(() => toEUR(total, currency), [total, currency]);
  const stockOk = useMemo(() => {
    if (!selectedProduct || selectedProduct.stock == null) return true;
    return Number(selectedProduct.stock) - Number(qty || 0) >= 0;
  }, [selectedProduct, qty]);
  const canSave = useMemo(() => !!productId && Number(qty) > 0 && stockOk, [productId, qty, stockOk]);

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, ref, price, stock, currency")
      .order("name", { ascending: true });
    if (!error) setProducts(data || []);
  }

  // Exports helpers
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

  function exportCSV() {
    const headers = [
      ["Date", "Produit", "Ref", "Lieu", "Paiement", "Qté", "Unitaire", "Total", "Devise", "Total_XOF", "Total_EUR"]
    ];
    const rows = sales.map((s) => [
      new Date(s.created_at).toISOString(),
      s.products?.name || "",
      s.products?.ref || "",
      s.location || "",
      s.payment_method || "",
      s.qty,
      Number(s.unit_price || 0).toFixed(2),
      Number(s.total || 0).toFixed(2),
      s.currency,
      Number(s.total_xof || 0).toFixed(2),
      fromXOFtoEUR(s.total_xof || 0).toFixed(2),
    ]);
    download(`ventes_${year}-${String(month).padStart(2, "0")}.csv`, toCSV([...headers, ...rows]));
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    const title = `Ventes ${String(month).padStart(2, "0")}/${year}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px;text-align:left} th{background:#f5f5f5}</style>
    </head><body><h2>${title}</h2>
    <table><thead><tr><th>Date</th><th>Produit</th><th>Ref</th><th>Lieu</th><th>Paiement</th><th>Qté</th><th>Total</th><th>Devise</th><th>Total EUR</th></tr></thead><tbody>
    ${sales.map(s => `<tr>
      <td>${new Date(s.created_at).toLocaleString()}</td>
      <td>${s.products?.name || ""}</td>
      <td>${s.products?.ref || ""}</td>
      <td>${s.location || ""}</td>
      <td>${s.payment_method || ""}</td>
      <td>${s.qty}</td>
      <td>${Number(s.total || 0).toFixed(2)}</td>
      <td>${s.currency}</td>
      <td>${fromXOFtoEUR(s.total_xof || 0).toFixed(2)} €</td>
    </tr>`).join("")}
    </tbody></table></body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  function exportAccounting() {
    // Simple accounting CSV combining essentials
    const headers = [["date","type","description","amount_eur","amount_xof","currency","location","payment_method","product_ref"]];
    const rows = sales.map((s) => [
      new Date(s.created_at).toISOString(),
      "SALE",
      s.products?.name || "",
      fromXOFtoEUR(s.total_xof || 0).toFixed(2),
      Number(s.total_xof || 0).toFixed(2),
      s.currency,
      s.location || "",
      s.payment_method || "",
      s.products?.ref || "",
    ]);
    download(`compta_ventes_${year}-${String(month).padStart(2, "0")}.csv`, toCSV([...headers, ...rows]));
  }

  async function purgeAllSales() {
    if (!confirm("Supprimer toutes les ventes du mois sélectionné ?")) return;
    try {
      const { start, end } = monthRange(year, month);
      const { error } = await supabase
        .from("sales")
        .delete()
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      await loadSales();
    } catch (e) {
      alert(e?.message || "Erreur lors de la purge");
    }
  }

  function monthRange(y, m) {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function loadSales() {
    setLoading(true);
    try {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("sales")
        .select("id, created_at, product_id, qty, unit_price, total, total_xof, currency, location, payment_method, products(name, ref)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSales(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    loadSales();
  }, [month, year]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel("sales-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        loadSales();
        loadProducts();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function createSale() {
    if (!canSave || !selectedProduct) return;
    setSaving(true);
    try {
      // Insert sale
      const payload = {
        product_id: productId,
        qty: Number(qty),
        unit_price: unitPrice,
        total: unitPrice * Number(qty),
        location,
        payment_method: payment,
        currency, // trigger will also convert total_xof
      };
      const { error: insertErr } = await supabase.from("sales").insert(payload);
      if (insertErr) throw insertErr;

      // Decrement stock if present
      if (selectedProduct.stock != null) {
        const newStock = Math.max(0, Number(selectedProduct.stock) - Number(qty));
        const { error: updErr } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", productId);
        if (updErr) throw updErr;
      }

      // Reset form
      setOpen(false);
      setProductId("");
      setQty("1");
      setLocation("Abidjan");
      setPayment("Espèces");
      setCurrency("XOF");
      await loadProducts();
      await loadSales();
      // Optionally show toast here
    } catch (e) {
      alert(e?.message || "Erreur lors de l'enregistrement de la vente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Ventes</h1>
        <p className="text-sm text-neutral-500">Enregistrez une vente en sélectionnant l'article, la variante, le canal, le lieu et le mode de paiement.</p>
      </div>
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded-md bg-black text-white" onClick={() => setOpen(true)}>Nouvelle vente</button>
        <button className="px-3 py-2 rounded-md border">Importer (CSV)</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportCSV}>Exporter (CSV)</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportPDF}>Exporter (PDF)</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportAccounting}>Export comptable</button>
        <button className="px-3 py-2 rounded-md border border-red-300 text-red-600" onClick={purgeAllSales}>Purger</button>
      </div>
      {/* Filtres Mois/Année */}
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
      {/* Tableau ventes */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Article</th>
              <th className="p-3 text-left">Lieu</th>
              <th className="p-3 text-left">Paiement</th>
              <th className="p-3 text-right">Qté</th>
              <th className="p-3 text-right">PU</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={7}>Chargement…</td></tr>
            ) : sales.length === 0 ? (
              <tr><td className="p-3" colSpan={7}>Aucune vente pour le moment.</td></tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="p-3">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-3">{s.products?.name || "—"} <span className="text-xs text-neutral-500">({s.products?.ref})</span></td>
                  <td className="p-3">{s.location}</td>
                  <td className="p-3">{s.payment_method}</td>
                  <td className="p-3 text-right">{s.qty}</td>
                  <td className="p-3 text-right">{Number(s.unit_price).toFixed(2)}</td>
                  <td className="p-3 text-right font-medium">{Number(s.total).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nouvelle vente */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Nouvelle vente</div>
              <button className="px-3 py-1 rounded-md border" onClick={() => setOpen(false)}>Fermer</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm text-neutral-600 mb-1">Produit</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (Ref: {p.ref}){p.stock != null ? ` — Stock: ${p.stock}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Quantité</label>
                <input type="number" min="1" className="w-full rounded-md border px-3 py-2 bg-transparent" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Prix unitaire</label>
                <input readOnly className="w-full rounded-md border px-3 py-2 bg-neutral-50 dark:bg-neutral-900" value={unitPrice.toFixed(2)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Lieu</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={location} onChange={(e) => setLocation(e.target.value)}>
                  {LOCATIONS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Mode de paiement</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Devise</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-500">Total</div>
                  <div className="text-lg font-semibold">{total.toFixed(2)} {currency === 'XOF' ? 'CFA' : '€'}</div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-neutral-500">Équiv. EUR</div>
                  <div className="text-sm font-medium">{toEUR(total, currency).toFixed(2)} €</div>
                </div>
                {!stockOk && (
                  <div className="text-xs text-red-600 mt-1">Stock insuffisant pour cette quantité.</div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-md border" onClick={() => setOpen(false)} disabled={saving}>Annuler</button>
              <button className="px-3 py-2 rounded-md bg-black text-white disabled:opacity-50" onClick={createSale} disabled={!canSave || saving}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
