"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const TYPES = [
  { value: "BOUTIQUE", label: "Boutique" },
  { value: "EN_LIGNE", label: "En ligne" },
  { value: "POP_UP", label: "Pop-up store" },
];

export default function SettingsChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, type, active")
        .order("name", { ascending: true });
      if (error) throw error;
      setChannels(data || []);
    } catch (e) {
      setError(e?.message || "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createChannel() {
    if (!canCreate) return;
    try {
      const payload = { name: name.trim(), type: type || null, active: true };
      const { error } = await supabase.from("channels").insert(payload);
      if (error) throw error;
      setName("");
      setType("");
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function toggleActive(id, active) {
    try {
      const { error } = await supabase
        .from("channels")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer ce canal ?")) return;
    try {
      const { error } = await supabase
        .from("channels")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres • Canaux de vente</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Ajoutez, renommez, activez/désactivez ou supprimez vos canaux (Boutique, En ligne, Pop-up).
        </p>
        <div className="mt-3">
          <Link href="/settings" className="px-3 py-1.5 rounded-md border">← Retour</Link>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
        <div className="font-medium">Nouveau canal</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Nom</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-transparent border-neutral-300 dark:border-neutral-700"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boutique"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Type (optionnel)</label>
            <select
              className="rounded-md border px-3 py-2 bg-transparent border-neutral-300 dark:border-neutral-700"
              value={type ?? ""}
              onChange={(e) => setType(e.target.value || "")}
            >
              <option value="">(aucun)</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={createChannel}
            disabled={!canCreate}
            className="h-[38px] sm:h-[40px] rounded-md px-4 bg-black text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="p-3">Nom</th>
              <th className="p-3">Type</th>
              <th className="p-3">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={4}>Chargement…</td>
              </tr>
            ) : error ? (
              <tr>
                <td className="p-3 text-red-600" colSpan={4}>{error}</td>
              </tr>
            ) : channels.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={4}>Aucun canal pour le moment.</td>
              </tr>
            ) : (
              channels.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">{TYPES.find((t) => t.value === c.type)?.label ?? "—"}</td>
                  <td className="p-3">{c.active ? "Actif" : "Inactif"}</td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      className="px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700"
                    >
                      {c.active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="px-2 py-1 rounded-md border border-red-300 text-red-600 dark:border-red-700"
                    >
                      Supprimer
                    </button>
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
