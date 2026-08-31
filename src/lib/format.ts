/**
 * Formats an integer number of pence as a GBP string.
 *
 * Money is stored as integer pence throughout (see docs/project-brief.md §6).
 * Whole pounds drop the decimals, because gallery prices read better as "£45"
 * than "£45.00".
 */
export const formatPrice = (pence: number): string => {
  if (!Number.isInteger(pence)) {
    throw new TypeError(`Price must be an integer number of pence, received ${pence}`);
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
};
