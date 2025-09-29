import Link from "next/link";

export default function SettingsPage() {
  const sections = [
    { title: "Canaux de vente", desc: "Ajouter, renommer, activer/désactiver des canaux (Boutique, En ligne, Pop-up store, etc.)", href: "/settings/channels" },
    { title: "Lieux", desc: "Associer des lieux aux canaux (ville, pays, adresse)", href: "/settings/locations" },
    { title: "TVA", desc: "Définir des taux de TVA par lieu avec périodes de validité", href: "/settings/vat" },
    { title: "Modes de paiement", desc: "Orange Money, Moov Money, MTN Money, Wave, Carte bancaire, Espèces, etc.", href: "/settings/payment-methods" },
    { title: "Catégories", desc: "Catégories produits et dépenses, avec codes OHADA optionnels", href: "/settings/categories" },
    { title: "Utilisateurs & Rôles", desc: "Admins et vendeurs (accès restreints)", href: "/settings/users-roles" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-sm text-neutral-500">Configurez votre boutique: canaux, lieux, TVA, paiements, catégories et rôles.</p>
      </div>
      {/* Actions rapides */}
      <div className="flex flex-wrap gap-2">
        <Link href="/settings/channels" className="px-3 py-2 rounded-md bg-black text-white">Nouveau canal</Link>
        <Link href="/settings/locations" className="px-3 py-2 rounded-md border">Nouveau lieu</Link>
        <Link href="/settings/payment-methods" className="px-3 py-2 rounded-md border">Ajouter un mode de paiement</Link>
        <Link href="/settings/categories" className="px-3 py-2 rounded-md border">Ajouter une catégorie</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => {
          const card = (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-sm transition">
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-neutral-500 mt-1">{s.desc}</div>
            </div>
          );
          return s.href ? (
            <Link key={s.title} href={s.href}>{card}</Link>
          ) : (
            <div key={s.title}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
