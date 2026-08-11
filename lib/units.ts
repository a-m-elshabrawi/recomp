/**
 * This project uses metric units throughout (kg for weight, cm for
 * length) — there is no per-user unit preference. weight_logs.weight_kg
 * and similar columns are already stored in kg, so this just formats for
 * display.
 */
export function formatWeightKg(kg: number, fractionDigits: number = 1): string {
  return `${kg.toFixed(fractionDigits)} kg`;
}
