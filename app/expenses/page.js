"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LOCATIONS, CURRENCIES, EXPENSE_CATEGORIES } from "@/lib/constants";

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());

  // Form
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [location, setLocation] = useState("Abidjan");
  const [category, setCategory] = useState("Conception");
  const canSave = useMemo(() => title.trim() && amount !== "", [title, amount]);

  function monthRange(y, m) {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

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

  function exportCSV() {
    const headers = [["Date","Intitulé","Lieu","Catégorie","Montant","Devise","Montant_XOF"]];
    const rows = expenses.map((e) => [
      new Date(e.created_at).toISOString(),
      e.title,
      e.location,
      e.category,
      Number(e.amount || 0).toFixed(2),
      e.currency,
      Number(e.amount_xof || 0).toFixed(2),
    ]);
    download(`depenses_${year}-${String(month).padStart(2, "0")}.csv`, toCSV([...headers, ...rows]));
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    const title = `Dépenses ${String(month).padStart(2, "0")}/${year}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px;text-align:left} th{background:#f5f5f5}</style>
    </head><body><h2>${title}</h2>
    <table><thead><tr><th>Date</th><th>Intitulé</th><th>Lieu</th><th>Catégorie</th><th>Montant</th><th>Devise</th></tr></thead><tbody>
    ${expenses.map(e => `<tr>
      <td>${new Date(e.created_at).toLocaleString()}</td>
      <td>${e.title}</td>
      <td>${e.location}</td>
      <td>${e.category}</td>
      <td>${Number(e.amount || 0).toFixed(2)}</td>
      <td>${e.currency}</td>
    </tr>`).join("")}
    </tbody></table></body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  function exportAccounting() {
    const headers = [["date","type","description","amount","currency","amount_xof","location","category"]];
    const rows = expenses.map((e) => [
      new Date(e.created_at).toISOString(),
      "EXPENSE",
      e.title,
      Number(e.amount || 0).toFixed(2),
      e.currency,
      Number(e.amount_xof || 0).toFixed(2),
      e.location,
      e.category,
    ]);
    download(`compta_depenses_${year}-${String(month).padStart(2, "0")}.csv`, toCSV([...headers, ...rows]));
  }

  async function purgeAllExpenses() {
    if (!confirm("Supprimer toutes les dépenses du mois sélectionné ?")) return;
    try {
      const { start, end } = monthRange(year, month);
      const { error } = await supabase
        .from("expenses")
        .delete()
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur lors de la purge");
    }
  }

  async function load() {
    setLoading(true);
    try {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("expenses")
        .select("id, title, amount, currency, amount_xof, location, category, created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [month, year]);

  useEffect(() => {
    const ch = supabase
      .channel("expenses-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function createExpense() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        amount: Number(amount),
        currency,
        location,
        category,
      };
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) throw error;
      setOpen(false);
      setTitle("");
      setAmount("");
      setCurrency("XOF");
      setLocation("Abidjan");
      setCategory("Conception");
      await load();
    } catch (e) {
      alert(e?.message || "Erreur lors de l'ajout de la dépense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dépenses</h1>
        <p className="text-sm text-neutral-500">Enregistrez vos dépenses (loyer, salaires, achat stock, marketing, etc.) avec devise, lieu et catégorie.</p>
      </div>
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded-md bg-black text-white" onClick={() => setOpen(true)}>Nouvelle dépense</button>
        <button className="px-3 py-2 rounded-md border">Importer (CSV)</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportCSV}>Exporter (CSV)</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportPDF}>Exporter (PDF)</button>
        <button className="px-3 py-2 rounded-md border" onClick={exportAccounting}>Export comptable</button>
        <button className="px-3 py-2 rounded-md border border-red-300 text-red-600" onClick={purgeAllExpenses}>Purger</button>
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
      {/* Tableau dépenses */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Intitulé</th>
              <th className="p-3 text-left">Lieu</th>
              <th className="p-3 text-left">Catégorie</th>
              <th className="p-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Chargement…</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Aucune dépense.</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="p-3">{e.title}</td>
                  <td className="p-3">{e.location}</td>
                  <td className="p-3">{e.category}</td>
                  <td className="p-3 text-right">{Number(e.amount).toFixed(2)} {e.currency === 'XOF' ? 'CFA' : '€'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Nouvelle dépense</div>
              <button className="px-3 py-1 rounded-md border" onClick={() => setOpen(false)}>Fermer</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm text-neutral-600 mb-1">Intitulé</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Montant</label>
                <input type="number" min="0" step="0.01" className="w-full rounded-md border px-3 py-2 bg-transparent" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Devise</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
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
                <label className="block text-sm text-neutral-600 mb-1">Catégorie</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-md border" onClick={() => setOpen(false)} disabled={saving}>Annuler</button>
              <button className="px-3 py-2 rounded-md bg-black text-white disabled:opacity-50" onClick={createExpense} disabled={!canSave || saving}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
