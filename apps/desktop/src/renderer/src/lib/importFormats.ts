export interface FormatColumn { name: string; required: boolean; headers: string; format: string }
export interface ImportFormat { columns: FormatColumn[]; notes: string[]; example: string[] }

const optional = (name: string, headers: string, format: string): FormatColumn => ({ name, required: false, headers, format });
const required = (name: string, headers: string, format: string): FormatColumn => ({ name, required: true, headers, format });

const MONEY = 'Rupees, up to 2 decimals. ₹, Rs. and comma grouping are fine (1,250.50).';
const SKU = optional('Item code', 'SKU, Item Code, Product Code, Code', 'Up to 40 characters.');
const BARCODE = optional('Barcode', 'Barcode, EAN, UPC, GTIN', 'The digits printed under the bars.');
const PHONE = optional('Phone', 'Phone, Mobile, Mobile No, Contact', '6–15 digits; spaces and dashes are removed.');
const EMAIL = optional('Email', 'Email, Email ID', 'name@example.com');
const ADDRESS = [
  optional('Address', 'Address, Billing Address', 'Up to 200 characters.'),
  optional('City', 'City, Town', 'Up to 80 characters.'),
  optional('PIN code', 'PIN Code, PIN, Postal Code', 'Exactly 6 digits.'),
  optional('Credit days', 'Credit Days, Credit Period, Payment Terms', 'Whole number, 0–365.'),
];
const OPENING_DATE = optional('Opening date', 'Opening Date, As Of, Balance Date', 'YYYY-MM-DD or DD/MM/YYYY; not in the future. Blank means today.');
const PARTY_NOTES = [
  'A row is skipped as "already exists" when its GSTIN or phone matches someone on file. Names alone are not compared.',
  'A GSTIN sets the state by itself; a different state code beside it is an error.',
];

export const PRODUCT_FORMAT: ImportFormat = {
  columns: [
    required('Name', 'Name, Item Name, Product Name, Item, Description', 'Up to 120 characters; any language.'),
    SKU,
    optional('Barcode(s)', 'Barcode, Barcodes, EAN, UPC, GTIN', 'Several in one cell, separated by ; or |'),
    optional('HSN / SAC', 'HSN, HSN Code, SAC', '4–8 digits.'),
    optional('Category', 'Category, Group, Item Group', 'Created if it does not exist yet.'),
    optional('Brand', 'Brand, Make, Company', 'Created if it does not exist yet.'),
    optional('Unit', 'Unit, UOM, Units', '1–8 capital letters or digits (PCS, KG, BOX). Blank means PCS.'),
    optional('MRP', 'MRP, Max Retail Price', MONEY),
    optional('Selling price', 'Sale Price, Selling Price, Price, Rate', `${MONEY} Not above the MRP.`),
    optional('Purchase price', 'Purchase Price, Cost Price, Cost', MONEY),
    optional('GST %', 'GST, GST %, GST Rate, Tax', 'A percentage such as 5 or 18; the % sign is optional.'),
    optional('Reorder level', 'Reorder Level, Reorder, Min Stock', 'A quantity, up to 3 decimals.'),
  ],
  notes: ['A product whose item code or barcode is already on file is shown as "already exists"; you choose whether to update or skip it.'],
  example: ['Item Name,Item Code,Barcode,HSN,Category,Brand,Unit,MRP,Sale Price,Purchase Price,GST %,Reorder Level', 'Tata Salt 1kg,SALT1,8901000000040,2501,Staples,Tata,PCS,28,27,23.50,0,20'],
};

export const OPENING_STOCK_FORMAT: ImportFormat = {
  columns: [
    { ...SKU, format: 'Either this or a barcode is needed; the product must already exist.' },
    BARCODE,
    required('Quantity', 'Qty, Quantity, Stock, Opening Stock, On Hand', 'Above zero, in the product\'s base unit, up to 3 decimals.'),
    optional('Unit cost', 'Unit Cost, Cost, Cost Price, Purchase Price, Rate', `${MONEY} Blank uses the product's purchase price.`),
  ],
  notes: ['Each product may appear once, and only if it has no opening stock yet.'],
  example: ['Item Code,Opening Stock,Cost Price', 'SALT1,60,23.50'],
};

export const PURCHASE_LINES_FORMAT: ImportFormat = {
  columns: [
    { ...SKU, format: 'Either this or a barcode is needed; the product must already exist.' },
    BARCODE,
    required('Quantity', 'Qty, Quantity, Units', 'Above zero, up to 3 decimals.'),
    optional('Unit', 'Unit, UOM, Unit Code', 'A unit the product is sold in. Blank means its base unit.'),
    optional('Rate', 'Rate, Price, Unit Price, Purchase Price, Cost', MONEY),
    optional('GST %', 'GST, GST %, GST Rate, Tax', 'A percentage such as 5 or 18.'),
    optional('Discount', 'Discount, Disc, Discount Percent', 'A percentage.'),
  ],
  notes: ['The file only fills the lines below; nothing is saved until you save the bill.'],
  example: ['Item Code,Qty,Rate,GST %', 'SALT1,24,23.50,0'],
};

export const CUSTOMER_FORMAT: ImportFormat = {
  columns: [
    required('Name', 'Name, Customer Name, Customer, Party Name', 'Up to 120 characters.'),
    PHONE, EMAIL,
    optional('GSTIN', 'GSTIN, GST No, GST Number', '15 characters, e.g. 07AAACR5055K1Z5.'),
    optional('State code', 'State Code, State', 'The 2-digit GST state code (07 for Delhi). Not needed with a GSTIN.'),
    ...ADDRESS,
    optional('Opening balance', 'Opening Balance, Balance, Outstanding, Dues', `${MONEY} What the customer owes you; a minus sign means you owe them.`),
    OPENING_DATE,
  ],
  notes: PARTY_NOTES,
  example: ['Name,Phone,GSTIN,City,PIN Code,Credit Days,Opening Balance,Opening Date', 'Ramesh Traders,9876543210,07AAACR5055K1Z5,Delhi,110006,30,1250.50,01/04/2026'],
};

export const SUPPLIER_FORMAT: ImportFormat = {
  columns: [
    required('Name', 'Name, Supplier Name, Supplier, Vendor, Party Name', 'Up to 120 characters.'),
    PHONE, EMAIL,
    optional('GSTIN', 'GSTIN, GST No, GST Number', '15 characters. Required unless the supplier is unregistered.'),
    { ...optional('State code', 'State Code, State', 'The 2-digit GST state code (07 for Delhi).'), name: 'State code (required without a GSTIN)' },
    optional('Tax scheme', 'Tax Scheme, GST Type, Registration Type', 'regular, composition or unregistered. Blank means regular with a GSTIN, unregistered without.'),
    ...ADDRESS,
    optional('Opening balance', 'Opening Balance, Balance, Outstanding, Dues', `${MONEY} What you owe the supplier; a minus sign means they owe you.`),
    OPENING_DATE,
  ],
  notes: PARTY_NOTES,
  example: ['Name,Phone,GSTIN,State Code,Tax Scheme,Opening Balance', 'Gupta Distributors,9111111111,07AAACG2222K1Z3,,regular,5000'],
};
