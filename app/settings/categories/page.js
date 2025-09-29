"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const SCOPES = [
  { value: "PRODUCT", label: "Produits" },
  { value: "EXPENSE", label: "Dépenses" },
];

export default function SettingsCategoriesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [scope, setScope] = useState("PRODUCT");
  const canCreate = useMemo(() => name.trim().length > 0 && scope, [name, scope]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, scope, created_at")
        .order("scope", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setError(e?.message || "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createItem() {
    if (!canCreate) return;
    try {
      const payload = { name: name.trim(), scope };
      const { error } = await supabase.from("categories").insert(payload);
      if (error) throw error;
      setName(""); setScope("PRODUCT");
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres • Catégories</h1>
        <p className="text-sm text-neutral-500 mt-1">Gérez vos catégories de produits et de dépenses.</p>
        <div className="mt-3">
          <Link href="/settings" className="px-3 py-1.5 rounded-md border">← Retour</Link>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-medium">Nouvelle catégorie</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-sm text-neutral-600 mb-1">Nom</label>
            <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vêtements" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Portée</label>
            <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>
        </div>
        <div>
          <button onClick={createItem} disabled={!canCreate} className="rounded-md px-4 py-2 bg-black text-white disabled:opacity-50">Ajouter</button>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Nom</th>
              <th className="p-3 text-left">Portée</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={3}>Chargement…</td></tr>
            ) : error ? (
              <tr><td className="p-3 text-red-600" colSpan={3}>{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3" colSpan={3}>Aucune catégorie.</td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-3">{it.name}</td>
                  <td className="p-3">{it.scope === 'PRODUCT' ? 'Produits' : 'Dépenses'}</td>
                  <td className="p-3 text-right space-x-2">
                    <button className="px-2 py-1 rounded-md border border-red-300 text-red-600" onClick={() => remove(it.id)}>Supprimer</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
