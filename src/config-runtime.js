/** Values read from the environment at build time, isolated so config.js stays
 *  importable from plain Node (tests, simulations) with no import.meta shims. */
export const CONFIG_MONTHLY_CAP = Number(import.meta.env?.VITE_ENRICH_MONTHLY_CAP ?? 2000);
