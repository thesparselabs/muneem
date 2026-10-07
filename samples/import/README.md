# Sample import files

Kirana-shop data for trying the file imports in the desktop app. Import them in the numbered order: the later files
refer to products the earlier ones create.

| File | Where to import | What it shows |
|---|---|---|
| `1-products.csv` | Products → **Import from file** | 45 clean products across 8 categories, with barcodes, HSN, GST rates and loose `KG` items. Creates the categories, brands and the `KG` / `TRAY` units. |
| `2-products-price-update.csv` | Products → **Import from file** | 6 products already in file 1 with new prices (shown as duplicates: choose **update** or **skip**) plus 2 new ones. |
| `3-products-with-errors.csv` | Products → **Import from file** | 9 rows that are refused (no name, text price, price above MRP, bad HSN, bad GST, bad unit, repeated SKU, repeated barcode, negative price) and 3 that import. |
| `4-opening-stock.csv` | Inventory → **Opening stock** | Quantity and cost for every product in file 1, matched by item code. |
| `6-customers.csv` | Parties → Customers → **Import from file** | 9 customers that import (6 with an opening balance, one of them an advance) and 3 refused rows: bad phone, state that contradicts the GSTIN, repeated phone. |
| `7-suppliers.csv` | Parties → Suppliers → **Import from file** | 6 suppliers (regular, composition and unregistered; 4 with an opening balance) and 2 refused rows: no state, unknown tax scheme. |
| `5-opening-stock-with-errors.csv` | Inventory → **Opening stock** | 2 good rows (one matched by barcode, cost taken from the product) and 6 refused: unknown SKU, no SKU or barcode, product that already has opening stock, zero quantity, text quantity, text cost. |

Opening stock can be recorded once per product, so `4-opening-stock.csv` imports only the first time; a second attempt
shows every row as "already has opening stock".

Customers and suppliers already on file (same GSTIN or phone) are skipped, so importing files 6 and 7 a second time adds
nothing. Opening balances need a terminal to be selected.

The GSTINs are made-up, the barcodes are made-up EAN-13 numbers with valid check digits, and the prices are illustrative.
