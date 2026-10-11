// How each kind of claim is written on a page. One place, so the website, the
// docs and the repo check scripts all show the same digits.
const grouped = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const FORMATS = {
  ratio2: (v) => `${v.toFixed(2)}×`,
  pct0: (v) => `${Math.round(v * 100)}%`,
  pct1: (v) => `${(v * 100).toFixed(1)}%`,
  pct2: (v) => `${(v * 100).toFixed(2)}%`,
  dec2: (v) => v.toFixed(2),
  dec4: (v) => v.toFixed(4),
  years0: (v) => grouped(v, 0),
  years1: (v) => grouped(v, 1),
  int: (v) => grouped(v, 0),
  mean1: (v) => grouped(v, 1),
  days3: (v) => v.toFixed(3),
  mb1: (kib) => `${(kib / 1024).toFixed(1)} MB`,
  text: (v) => String(v),
};
