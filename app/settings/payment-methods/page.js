"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function SettingsPaymentMethodsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, name, active, created_at")
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
      const payload = { name: name.trim(), active: true };
      const { error } = await supabase.from("payment_methods").insert(payload);
      if (error) throw error;
      setName("");
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function toggleActive(id, active) {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer ce mode de paiement ?")) return;
    try {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres • Modes de paiement</h1>
        <p className="text-sm text-neutral-500 mt-1">Gérez vos modes de paiement.</p>
        <div className="mt-3">
          <Link href="/settings" className="px-3 py-1.5 rounded-md border">← Retour</Link>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-medium">Nouveau mode de paiement</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Nom</label>
            <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Espèces" />
          </div>
          <button onClick={createItem} disabled={!canCreate} className="h-[40px] rounded-md px-4 bg-black text-white disabled:opacity-50">Ajouter</button>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Nom</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={3}>Chargement…</td></tr>
            ) : error ? (
              <tr><td className="p-3 text-red-600" colSpan={3}>{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3" colSpan={3}>Aucun mode.</td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-3">{it.name}</td>
                  <td className="p-3">{it.active ? "Actif" : "Inactif"}</td>
                  <td className="p-3 text-right space-x-2">
                    <button className="px-2 py-1 rounded-md border" onClick={() => toggleActive(it.id, it.active)}>{it.active ? "Désactiver" : "Activer"}</button>
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
