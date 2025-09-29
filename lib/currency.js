export const EUR_TO_XOF = 655.957; // fixed peg for XOF (approx)

export function locationToCurrency(loc) {
  const l = (loc || "").toLowerCase();
  if (l === "abidjan") return "XOF"; // FCFA
  // Paris and En ligne -> Euro
  return "EUR";
}

export function toXOF(amount, currency) {
  const a = Number(amount || 0);
  if (currency === "XOF") return a;
  if (currency === "EUR") return a * EUR_TO_XOF;
  return a;
}

export function fromXOFtoEUR(amountXof) {
  const a = Number(amountXof || 0);
  return a / EUR_TO_XOF;
}

export function toEUR(amount, currency) {
  const a = Number(amount || 0);
  if (currency === "EUR") return a;
  if (currency === "XOF") return a / EUR_TO_XOF;
  return a;
}

export function formatAmount(amount, currency) {
  const a = Number(amount || 0);
  if (currency === "XOF") {
    return `${a.toFixed(2)} CFA`;
  }
  if (currency === "EUR") {
    return `${a.toFixed(2)} €`;
  }
  return a.toFixed(2);
}
