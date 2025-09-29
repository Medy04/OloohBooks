"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function SettingsVatPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [location, setLocation] = useState("");
  const [rate, setRate] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const canCreate = useMemo(() => location.trim() && rate !== "" && validFrom.trim(), [location, rate, validFrom]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("vat_rates")
        .select("id, location, rate, valid_from, valid_to")
        .order("valid_from", { ascending: false });
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
      const payload = {
        location: location.trim(),
        rate: Number(rate),
        valid_from: validFrom,
        valid_to: validTo || null,
      };
      const { error } = await supabase.from("vat_rates").insert(payload);
      if (error) throw error;
      setLocation(""); setRate(""); setValidFrom(""); setValidTo("");
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer ce taux de TVA ?")) return;
    try {
      const { error } = await supabase.from("vat_rates").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres • TVA</h1>
        <p className="text-sm text-neutral-500 mt-1">Gérez vos taux de TVA par lieu/période.</p>
        <div className="mt-3">
          <Link href="/settings" className="px-3 py-1.5 rounded-md border">← Retour</Link>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-medium">Nouveau taux</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Lieu</label>
            <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Abidjan" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Taux (%)</label>
            <input type="number" min="0" step="0.01" className="w-full rounded-md border px-3 py-2 bg-transparent" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Valide du</label>
            <input type="date" className="w-full rounded-md border px-3 py-2 bg-transparent" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Valide jusqu'au (optionnel)</label>
            <input type="date" className="w-full rounded-md border px-3 py-2 bg-transparent" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
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
              <th className="p-3 text-left">Lieu</th>
              <th className="p-3 text-left">Taux</th>
              <th className="p-3 text-left">Valide du</th>
              <th className="p-3 text-left">Valide jusqu'au</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Chargement…</td></tr>
            ) : error ? (
              <tr><td className="p-3 text-red-600" colSpan={5}>{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Aucun taux.</td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-3">{it.location}</td>
                  <td className="p-3">{Number(it.rate).toFixed(2)}%</td>
                  <td className="p-3">{it.valid_from}</td>
                  <td className="p-3">{it.valid_to || "—"}</td>
                  <td className="p-3 text-right">
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
