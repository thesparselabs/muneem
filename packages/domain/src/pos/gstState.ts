// Chandigarh, Dadra & Nagar Haveli and Daman & Diu, Lakshadweep, Andaman & Nicobar, Ladakh: UTGST instead of SGST.
const UT_WITHOUT_LEGISLATURE = new Set(['04', '26', '31', '35', '38']);

export const isUtWithoutLegislature = (stateCode: string): boolean => UT_WITHOUT_LEGISLATURE.has(stateCode);
export const stateOfGstin = (gstin: string): string => gstin.slice(0, 2);
