const nf = (opts) => new Intl.NumberFormat("en-GB", opts);

export const number = (v, dp = 0) =>
  v == null ? "–" : nf({ minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v);

export const percent = (v, dp = 1) => (v == null ? "–" : `${number(v, dp)}%`);

export const pounds = (v) => (v == null ? "–" : `£${number(v)}`);

/** Short percentage for chart labels, matching the original's "<1%" style. */
export const barLabel = (v) => (v == null ? "n/a" : v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`);

export const ordinal = (n) => {
  if (n === 1) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]} `;
};

export const date = (d) =>
  d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
