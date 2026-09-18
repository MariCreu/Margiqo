export function money(value, currency = "EUR", numberLocale = "en-US") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(numberLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `€${Math.round(value)}`;
  }
}

export function moneyPrecise(value, currency = "EUR", numberLocale = "en-US") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(numberLocale, { style: "currency", currency }).format(value);
  } catch {
    return `€${value.toFixed(2)}`;
  }
}

export function pct(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}
