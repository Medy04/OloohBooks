"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erreur");
      router.replace(redirect);
    } catch (e) {
      setError(e.message || "Code incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-lg border p-6 bg-white dark:bg-black">
        <div className="flex items-center gap-2 mb-4">
          <Image src="/logo.png" alt="OloohBooks" width={28} height={28} />
          <div className="text-lg font-semibold">OloohBooks</div>
        </div>
        <div className="mb-4 text-sm text-neutral-600">Veuillez entrer le code d’accès administrateur pour continuer.</div>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Code d’accès</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 bg-transparent"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button disabled={loading} className="w-full rounded-md bg-black text-white py-2 disabled:opacity-50">
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <div className="mt-4 text-xs text-neutral-500">Astuce: le code est fourni par l’administrateur.</div>
      </div>
    </div>
  );
}
