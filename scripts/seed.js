// Seed initial data for OloohBooks
// Run with: node scripts/seed.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Channels
  const channels = [
    { name: "Boutique", type: "BOUTIQUE" },
    { name: "En ligne", type: "EN_LIGNE" },
    { name: "Pop-up store", type: "POP_UP" },
  ];

  for (const c of channels) {
    await prisma.channel.upsert({
      where: { name: c.name },
      create: { name: c.name, type: c.type, active: true },
      update: {},
    });
  }

  // Payment methods
  const payments = [
    "Orange Money",
    "Moov Money",
    "MTN Money",
    "Wave",
    "Carte bancaire",
    "Espèces",
  ];
  for (const p of payments) {
    await prisma.paymentMethod.upsert({
      where: { name: p },
      create: { name: p, active: true },
      update: {},
    });
  }

  // Expense categories with optional OHADA mapping left empty for now
  const expenseCats = [
    { name: "Loyer" },
    { name: "Salaires" },
    { name: "Achats stock" },
    { name: "Marketing" },
    { name: "Autres" },
  ];
  for (const e of expenseCats) {
    await prisma.expenseCategory.upsert({
      where: { name: e.name },
      create: { name: e.name },
      update: {},
    });
  }

  // Example product category
  await prisma.productCategory.upsert({
    where: { name: "Vêtements" },
    create: { name: "Vêtements" },
    update: {},
  });

  // Example product and variants
  const product = await prisma.product.upsert({
    where: { sku: "TSHIRT-CLASSIC" },
    create: {
      name: "T-Shirt Classic",
      sku: "TSHIRT-CLASSIC",
      description: "T-shirt basique de la marque",
      active: true,
    },
    update: {},
  });

  const variants = [
    { size: "S", color: "Noir", priceHTCents: 10000, priceTTCCents: 11800 },
    { size: "M", color: "Noir", priceHTCents: 10000, priceTTCCents: 11800 },
    { size: "L", color: "Noir", priceHTCents: 10000, priceTTCCents: 11800 },
  ];
  for (const v of variants) {
    await prisma.productVariant.upsert({
      where: { id: `${product.id}-${v.size}-${v.color}` },
      create: {
        productId: product.id,
        size: v.size,
        color: v.color,
        priceHTCents: v.priceHTCents,
        priceTTCCents: v.priceTTCCents,
        stock: 10,
      },
      update: {},
    });
  }

  console.log("Seed terminé ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
