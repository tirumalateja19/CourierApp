export const DIVISOR = { cm: 5000, in: 305 };
export const MAX_PACKAGES = 7;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Same rounding rule you have today: <20 kg rounds up to 0.5, otherwise up to the next kg
export const calcVolWeight = ({ unit = "cm", length, breadth, height }) => {
  const raw = (num(length) * num(breadth) * num(height)) / DIVISOR[unit];
  if (raw <= 0) return 0;
  return raw < 20 ? Math.ceil(raw * 2) / 2 : Math.ceil(raw);
};

export const calcBox = (box) => {
  const unit = box.unit === "in" ? "in" : "cm";
  const actualWeight = num(box.actualWeight);
  const volWeight = calcVolWeight({ ...box, unit });
  return {
    unit,
    length: num(box.length),
    breadth: num(box.breadth),
    height: num(box.height),
    actualWeight,
    volWeight,
    weight: Math.max(actualWeight, volWeight), // chargeable
  };
};

export const calcTotals = (boxes) => ({
  totalActualWeight: boxes.reduce((s, b) => s + b.actualWeight, 0),
  totalVolWeight: boxes.reduce((s, b) => s + b.volWeight, 0),
  totalChargeableWeight: boxes.reduce((s, b) => s + b.weight, 0),
});
