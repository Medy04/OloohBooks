"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function SettingsUsersRolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roleName, setRoleName] = useState("");
  const canCreate = useMemo(() => roleName.trim().length > 0, [roleName]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setRoles(data || []);
    } catch (e) {
      setError(e?.message || "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createRole() {
    if (!canCreate) return;
    try {
      const { error } = await supabase.from("roles").insert({ name: roleName.trim() });
      if (error) throw error;
      setRoleName("");
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  async function removeRole(id) {
    if (!confirm("Supprimer ce rôle ?")) return;
    try {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e?.message || "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres • Utilisateurs & Rôles</h1>
        <p className="text-sm text-neutral-500 mt-1">Gérez la liste des rôles (ex: Admin, Vendeur). L&apos;association utilisateurs↔rôles peut être ajoutée plus tard.</p>
        <div className="mt-3">
          <Link href="/settings" className="px-3 py-1.5 rounded-md border">← Retour</Link>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-medium">Nouveau rôle</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Nom</label>
            <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Ex: Admin" />
          </div>
          <button onClick={createRole} disabled={!canCreate} className="h-[40px] rounded-md px-4 bg-black text-white disabled:opacity-50">Ajouter</button>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Nom</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={2}>Chargement…</td></tr>
            ) : error ? (
              <tr><td className="p-3 text-red-600" colSpan={2}>{error}</td></tr>
            ) : roles.length === 0 ? (
              <tr><td className="p-3" colSpan={2}>Aucun rôle.</td></tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3 text-right">
                    <button className="px-2 py-1 rounded-md border border-red-300 text-red-600" onClick={() => removeRole(r.id)}>Supprimer</button>
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
