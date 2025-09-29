"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LOCATIONS, CURRENCIES } from "@/lib/constants";

export default function ProductsPage() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [ref, setRef] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("EN_STOCK");
  const [locations, setLocations] = useState([]); // array of strings
  const [files, setFiles] = useState([]);
  const [stock, setStock] = useState("");
  const [currency, setCurrency] = useState("XOF");

  // Filters
  const [q, setQ] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAvailability, setFilterAvailability] = useState("");

  // Toasts
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg: string }
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const canSave = useMemo(() => name.trim() && ref.trim() && price !== "", [name, ref, price]);

  function toggleLocation(loc) {
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  async function purgeAllProducts() {
    if (!confirm("Tout supprimer ? Cette action efface tous les produits et leurs photos.")) return;
    try {
      // Collect all photo paths
      const { data: all, error: allErr } = await supabase
        .from("products")
        .select("photos");
      if (allErr) throw allErr;
      const urlToPath = (url) => {
        try {
          const u = new URL(url);
          const idx = u.pathname.indexOf("/public/products/");
          if (idx !== -1) return u.pathname.substring(idx + "/public/products/".length);
          return u.pathname.replace(/^\/+/, "");
        } catch { return url; }
      };
      const paths = (all || [])
        .flatMap((row) => Array.isArray(row.photos) ? row.photos : [])
        .map((p) => urlToPath(p))
        .filter(Boolean);
      if (paths.length) {
        await supabase.storage.from("products").remove(paths);
      }
      const { error: delErr } = await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;
      await loadProducts();
      showToast("success", "Tous les produits ont été supprimés");
    } catch (e) {
      showToast("error", e?.message || "Erreur lors de la purge");
    }
  }

  async function handleCreateProduct() {
    if (!canSave) return;
    setSaving(true);
    try {
      // 1) Upload photos to Supabase Storage (bucket: products)
      const photoUrls = [];
      for (const f of files) {
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("products")
          .upload(path, f, { upsert: true, contentType: f.type || "application/octet-stream" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("products").getPublicUrl(path);
        if (pub?.publicUrl) photoUrls.push(pub.publicUrl);
      }

      // 2) Insert product row
      const payload = {
        name: name.trim(),
        ref: ref.trim(),
        price: Number(price),
        category: category || null,
        availability, // "EN_STOCK" | "RUPTURE"
        locations, // text[]
        photos: photoUrls, // jsonb[] of urls
        ...(stock !== "" ? { stock: Number(stock) } : {}),
        currency,
      };
      const { error: insertErr } = await supabase.from("products").insert(payload);
      if (insertErr) throw insertErr;

      // Reset form and close
      setName("");
      setRef("");
      setPrice("");
      setCategory("");
      setAvailability("EN_STOCK");
      setLocations([]);
      setFiles([]);
      setStock("");
      setCurrency("XOF");
      setOpen(false);
      await loadProducts();
      showToast("success", "Produit ajouté");
    } catch (e) {
      showToast("error", e?.message || "Erreur lors de l'ajout du produit");
    } finally {
      setSaving(false);
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      let query = supabase
        .from("products")
        .select("id, name, ref, price, category, availability, locations, photos, stock, currency, created_at")
        .order("created_at", { ascending: false });

      if (q?.trim()) {
        // filter name OR ref
        const s = q.trim();
        query = query.or(`name.ilike.%${s}%,ref.ilike.%${s}%`);
      }
      if (filterCategory && filterCategory !== "Toutes catégories") {
        query = query.eq("category", filterCategory);
      }
      if (filterAvailability && filterAvailability !== "Disponibilité: Tous") {
        query = query.eq("availability", filterAvailability === "En stock" ? "EN_STOCK" : "RUPTURE");
      }

      const { data, error } = await query;
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error(e);
      showToast("error", e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [ename, seteName] = useState("");
  const [eref, seteRef] = useState("");
  const [eprice, setePrice] = useState("");
  const [ecategory, seteCategory] = useState("");
  const [eavailability, seteAvailability] = useState("EN_STOCK");
  const [elocations, seteLocations] = useState([]);
  const [efiles, seteFiles] = useState([]);
  const [estock, seteStock] = useState("");
  const [ecurrency, seteCurrency] = useState("XOF");
  const canUpdate = useMemo(() => ename.trim() && eref.trim() && eprice !== "", [ename, eref, eprice]);

  function toggleELocation(loc) {
    seteLocations((prev) => (prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]));
  }

  function openEditModal(p) {
    setEditingId(p.id);
    seteName(p.name || "");
    seteRef(p.ref || "");
    setePrice(String(p.price ?? ""));
    seteCategory(p.category || "");
    seteAvailability(p.availability || "EN_STOCK");
    seteLocations(Array.isArray(p.locations) ? p.locations : []);
    seteFiles([]);
    seteStock(p.stock != null ? String(p.stock) : "");
    seteCurrency(p.currency || "XOF");
    setEditOpen(true);
  }

  async function handleUpdateProduct() {
    if (!canUpdate || !editingId) return;
    setSaving(true);
    try {
      let photoUrlsToSet = undefined; // keep existing if no new files
      if (efiles.length > 0) {
        const newUrls = [];
        for (const f of efiles) {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
          const { error: upErr } = await supabase.storage
            .from("products")
            .upload(path, f, { upsert: true, contentType: f.type || "application/octet-stream" });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("products").getPublicUrl(path);
          if (pub?.publicUrl) newUrls.push(pub.publicUrl);
        }
        photoUrlsToSet = newUrls;
      }

      const updatePayload = {
        name: ename.trim(),
        ref: eref.trim(),
        price: Number(eprice),
        category: ecategory || null,
        availability: eavailability,
        locations: elocations,
        ...(estock !== "" ? { stock: Number(estock) } : {}),
        currency: ecurrency,
        ...(photoUrlsToSet ? { photos: photoUrlsToSet } : {}),
      };

      const { error } = await supabase.from("products").update(updatePayload).eq("id", editingId);
      if (error) throw error;

      setEditOpen(false);
      await loadProducts();
      showToast("success", "Produit mis à jour");
    } catch (e) {
      showToast("error", e?.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(id) {
    if (!confirm("Supprimer ce produit ?")) return;
    try {
      // Load product to get photo paths
      const { data: toDelete, error: fetchErr } = await supabase
        .from("products")
        .select("photos")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      // Helper: convert public URL to storage path within bucket
      const urlToPath = (url) => {
        try {
          const u = new URL(url);
          // Expected pattern: /storage/v1/object/public/products/<path>
          const idx = u.pathname.indexOf("/public/products/");
          if (idx !== -1) {
            return u.pathname.substring(idx + "/public/products/".length);
          }
          // For private buckets or different setups, fallback: remove leading slashes
          return u.pathname.replace(/^\/+/, "");
        } catch {
          return url;
        }
      };

      const paths = Array.isArray(toDelete?.photos)
        ? toDelete.photos.map((p) => urlToPath(p)).filter(Boolean)
        : [];
      if (paths.length > 0) {
        // Attempt to remove files (ignore errors to not block DB deletion)
        await supabase.storage.from("products").remove(paths);
      }

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      await loadProducts();
      showToast("success", "Produit supprimé");
    } catch (e) {
      showToast("error", e?.message || "Erreur lors de la suppression");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Produits</h1>
        <p className="text-sm text-neutral-500">Gérez vos articles, variantes (taille, couleur), prix TTC/HT et stock.</p>
      </div>
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded-md border border-[#C5A029] bg-[#C5A029] text-white hover:bg-[#a78a22]" onClick={() => setOpen(true)}>Ajouter un produit</button>
        <button className="px-3 py-2 rounded-md border">Importer (CSV)</button>
        <button className="px-3 py-2 rounded-md border">Exporter (CSV)</button>
        <button className="px-3 py-2 rounded-md border border-red-600 bg-red-600 text-white hover:bg-red-700" onClick={purgeAllProducts}>Purger</button>
      </div>
      {/* Filtres */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 grid gap-3 sm:grid-cols-3">
        <input
          className="rounded-md border px-3 py-2 bg-transparent"
          placeholder="Recherche nom / référence"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
        />
        <select
          className="rounded-md border px-3 py-2 bg-transparent"
          value={filterCategory || "Toutes catégories"}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option>Toutes catégories</option>
          <option>Vêtements</option>
          <option>Accessoires</option>
        </select>
        <select
          className="rounded-md border px-3 py-2 bg-transparent"
          value={filterAvailability || "Disponibilité: Tous"}
          onChange={(e) => setFilterAvailability(e.target.value)}
        >
          <option>Disponibilité: Tous</option>
          <option>En stock</option>
          <option>Rupture</option>
        </select>
        <div className="sm:col-span-3 flex gap-2">
          <button className="px-3 py-2 rounded-md border" onClick={loadProducts}>Appliquer les filtres</button>
          <button
            className="px-3 py-2 rounded-md border"
            onClick={() => {
              setQ(""); setFilterCategory(""); setFilterAvailability(""); loadProducts();
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>
      {/* Tableau produits */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Photo</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Produit</th>
              <th className="p-3 text-left">Catégorie</th>
              <th className="p-3 text-left">Dispo</th>
              <th className="p-3 text-right">Prix TTC</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-left">Lieux</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={6}>Chargement…</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={6}>Aucun produit pour le moment.</td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-3">
                    {Array.isArray(p.photos) && p.photos[0] ? (
                      <img
                        src={p.photos[0]}
                        alt={p.name}
                        className="h-12 w-12 rounded object-cover border border-neutral-200 dark:border-neutral-800"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded border border-dashed grid place-items-center text-xs text-neutral-500">—</div>
                    )}
                  </td>
                  <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-neutral-500">Ref: {p.ref}</div>
                  </td>
                  <td className="p-3">{p.category || "—"}</td>
                  <td className="p-3">{p.availability === "EN_STOCK" ? "En stock" : "Rupture"}</td>
                  <td className="p-3 text-right">{Number(p.price || 0).toFixed(2)}</td>
                  <td className="p-3 text-right">{p.stock ?? "—"}</td>
                  <td className="p-3">{Array.isArray(p.locations) && p.locations.length ? p.locations.join(", ") : "—"}</td>
                  <td className="p-3 text-right space-x-2">
                    <button className="px-2 py-1 rounded-md border border-[#C5A029] bg-[#C5A029] text-white hover:bg-[#a78a22]" onClick={() => openEditModal(p)}>Éditer</button>
                    <button className="px-2 py-1 rounded-md border border-red-600 bg-red-600 text-white hover:bg-red-700" onClick={() => handleDeleteProduct(p.id)}>Supprimer</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Ajouter un produit */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Ajouter un produit</div>
              <button className="px-3 py-1 rounded-md border" onClick={() => setOpen(false)}>Fermer</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Nom</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Référence</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={ref} onChange={(e) => setRef(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Prix TTC</label>
                <input type="number" min="0" step="0.01" className="w-full rounded-md border px-3 py-2 bg-transparent" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Catégorie</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Vêtements" />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Stock</label>
                <input type="number" min="0" step="1" className="w-full rounded-md border px-3 py-2 bg-transparent" value={stock} onChange={(e) => setStock(e.target.value)} />
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
                <label className="block text-sm text-neutral-600 mb-1">Disponibilité</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={availability} onChange={(e) => setAvailability(e.target.value)}>
                  <option value="EN_STOCK">En stock</option>
                  <option value="RUPTURE">Rupture</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Lieux de vente</label>
                <div className="flex flex-wrap gap-2">
                  {LOCATIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={
                        "px-3 py-2 rounded-md border " +
                        (locations.includes(opt.value) ? "bg-neutral-900 text-white" : "")
                      }
                      onClick={() => toggleLocation(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-neutral-600 mb-1">Photos</label>
                <input multiple type="file" accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                {files?.length > 0 && (
                  <div className="text-xs text-neutral-500 mt-1">{files.length} fichier(s) sélectionné(s)</div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-md border" onClick={() => setOpen(false)} disabled={saving}>Annuler</button>
              <button className="px-3 py-2 rounded-md bg-black text-white disabled:opacity-50" onClick={handleCreateProduct} disabled={!canSave || saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Éditer un produit */}
      {editOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Éditer le produit</div>
              <button className="px-3 py-1 rounded-md border" onClick={() => setEditOpen(false)}>Fermer</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Nom</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={ename} onChange={(e) => seteName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Référence</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={eref} onChange={(e) => seteRef(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Prix TTC</label>
                <input type="number" min="0" step="0.01" className="w-full rounded-md border px-3 py-2 bg-transparent" value={eprice} onChange={(e) => setePrice(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Catégorie</label>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={ecategory} onChange={(e) => seteCategory(e.target.value)} placeholder="Ex: Vêtements" />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Stock</label>
                <input type="number" min="0" step="1" className="w-full rounded-md border px-3 py-2 bg-transparent" value={estock} onChange={(e) => seteStock(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Devise</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={ecurrency} onChange={(e) => seteCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Disponibilité</label>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={eavailability} onChange={(e) => seteAvailability(e.target.value)}>
                  <option value="EN_STOCK">En stock</option>
                  <option value="RUPTURE">Rupture</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Lieux de vente</label>
                <div className="flex flex-wrap gap-2">
                  {LOCATIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={
                        "px-3 py-2 rounded-md border " +
                        (elocations.includes(opt.value) ? "bg-neutral-900 text-white" : "")
                      }
                      onClick={() => toggleELocation(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-neutral-600 mb-1">Nouvelles photos (optionnel)</label>
                <input multiple type="file" accept="image/*" onChange={(e) => seteFiles(Array.from(e.target.files || []))} />
                {efiles?.length > 0 && (
                  <div className="text-xs text-neutral-500 mt-1">{efiles.length} fichier(s) sélectionné(s)</div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-md border" onClick={() => setEditOpen(false)} disabled={saving}>Annuler</button>
              <button className="px-3 py-2 rounded-md bg-black text-white disabled:opacity-50" onClick={handleUpdateProduct} disabled={!canUpdate || saving}>
                {saving ? "Enregistrement…" : "Mettre à jour"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={
            "fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 shadow " +
            (toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white")
          }
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
