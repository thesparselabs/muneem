// GST Unique Quantity Codes for the units the catalogue seeds; anything else is reported as OTH (others).
const UQC_OF_UNIT: Readonly<Record<string, string>> = {
  PCS: 'PCS', NOS: 'NOS', KG: 'KGS', KGS: 'KGS', G: 'GMS', GM: 'GMS', GMS: 'GMS', L: 'LTR', LTR: 'LTR', ML: 'MLT', MLT: 'MLT', M: 'MTR', MTR: 'MTR',
  DOZ: 'DOZ', BOX: 'BOX', CASE: 'CTN', CTN: 'CTN', PAC: 'PAC', PKT: 'PAC', BAG: 'BAG', BTL: 'BTL', SET: 'SET', PRS: 'PRS', PAIR: 'PRS', TON: 'TON',
  QTL: 'QTL', SQM: 'SQM', SQF: 'SQF', CM: 'CMS', UNT: 'UNT', ROL: 'ROL', TBS: 'TBS', CAN: 'CAN', BDL: 'BDL',
};

export const uqcOf = (unitCode: string): string => UQC_OF_UNIT[unitCode.trim().toUpperCase()] ?? 'OTH';

const UQC_NAMES: Readonly<Record<string, string>> = {
  BAG: 'BAGS', BDL: 'BUNDLES', BOX: 'BOX', BTL: 'BOTTLES', CAN: 'CANS', CMS: 'CENTIMETERS', CTN: 'CARTONS', DOZ: 'DOZENS', GMS: 'GRAMMES',
  KGS: 'KILOGRAMS', LTR: 'LITRES', MLT: 'MILILITRE', MTR: 'METERS', NOS: 'NUMBERS', OTH: 'OTHERS', PAC: 'PACKS', PCS: 'PIECES', PRS: 'PAIRS',
  QTL: 'QUINTAL', ROL: 'ROLLS', SET: 'SETS', SQF: 'SQUARE FEET', SQM: 'SQUARE METERS', TBS: 'TABLETS', TON: 'TONNES', UNT: 'UNITS',
};

// The offline tool's UQC form, e.g. "KGS-KILOGRAMS".
export const uqcLabel = (uqc: string): string => `${uqc}-${UQC_NAMES[uqc] ?? 'OTHERS'}`;

const STATE_NAMES: Readonly<Record<string, string>> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '96': 'Foreign Country', '97': 'Other Territory',
};

// The offline tool's place-of-supply form, e.g. "27-Maharashtra".
export const placeOfSupplyLabel = (code: string): string => `${code}-${STATE_NAMES[code] ?? 'Unknown'}`;
