# Muneem — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-09-26  
**Product:** Muneem  
**Category:** Offline-first business management / POS / inventory / accounting platform  
**Primary Platform:** Windows Desktop  
**Desktop Runtime:** Electron  
**UI:** React + TypeScript  
**Local Database:** SQLite  
**Cloud Database:** PostgreSQL  

---

# 1. Product Vision

Muneem is an **offline-first business operating system for Indian retail and wholesale SMBs**.

Muneem allows a business to:

- Sell products
- Create GST invoices
- Scan barcodes
- Print bills
- Accept payments
- Manage inventory
- Purchase stock
- Manage customers and suppliers
- Track credit and outstanding balances
- Calculate GST
- Maintain accounting records
- Generate business reports
- Continue operating without internet
- Synchronize automatically with the cloud when connectivity returns
- Connect to common retail hardware

## Core Promise

> **Your business keeps running even when the internet doesn't.**

Muneem should feel like one unified application rather than a collection of disconnected products.

---

# 2. Target Market

## 2.1 Primary ICP

Indian businesses with:

- 1–3 outlets
- 1–20 employees
- 100–5,000 SKUs
- 50–1,000 transactions/day
- Barcode-based inventory
- GST registration or GST requirements
- Windows computers
- Thermal printers
- Barcode scanners
- Cash drawers
- Intermittent or unreliable internet

## 2.2 Priority Segments

1. Grocery/general stores
2. Hardware stores
3. Electrical stores
4. Mobile/accessory stores
5. Garment stores
6. Footwear stores
7. Cosmetics stores
8. Stationery stores
9. Auto-parts stores
10. Building-material dealers
11. FMCG wholesalers
12. Small distributors

---

# 3. Product Principles

## P1 — Offline First

Core operations must work without internet.

## P2 — Hardware First

Muneem must integrate naturally with physical retail hardware.

## P3 — Simple by Default

A shop owner should not need accounting expertise to create a bill.

## P4 — Accounting Correctness

Financial transactions must be deterministic, auditable and mathematically correct.

## P5 — Cloud Connected

Cloud provides synchronization, backup, multi-device access and centralized management.

## P6 — One Application

POS, inventory, purchasing, accounting and GST should feel like one system.

## P7 — Never Lose a Transaction

A completed sale must remain recoverable even if:

- Internet disappears
- Application closes
- Printer fails
- Computer restarts
- Cloud is unavailable

---

# 4. High-Level Architecture

```text
                         MUNEEM CLOUD
                  ┌─────────────────────────┐
                  │ API                     │
                  │ PostgreSQL              │
                  │ Object Storage          │
                  │ Authentication          │
                  │ Sync Services           │
                  │ Notifications            │
                  │ Reporting                │
                  └────────────┬────────────┘
                               │
                         Sync Protocol
                               │
                  ┌────────────▼────────────┐
                  │      MUNEEM DESKTOP     │
                  │        ELECTRON         │
                  │                         │
                  │  ┌───────────────────┐  │
                  │  │ React Renderer     │  │
                  │  │ TypeScript UI     │  │
                  │  └─────────┬─────────┘  │
                  │            │ IPC        │
                  │  ┌─────────▼─────────┐  │
                  │  │ Preload / Bridge   │  │
                  │  └─────────┬─────────┘  │
                  │            │             │
                  │  ┌─────────▼─────────┐  │
                  │  │ Electron Main     │  │
                  │  │ Services          │  │
                  │  └─────┬──────┬─────┘  │
                  │        │      │         │
                  │      SQLite  Hardware   │
                  └────────┼──────┼─────────┘
                           │      │
                    Local Data   Devices
```

---

# 5. Technology Stack

## Desktop

- Electron
- React
- TypeScript
- Node.js
- Electron preload scripts
- Secure IPC
- SQLite

## Cloud

- Backend API: Go or NestJS
- PostgreSQL
- Redis
- Object storage
- Background job/queue system

## Desktop Architecture

```text
React Renderer
      ↓
Preload API
      ↓
Electron IPC
      ↓
Application Services
      ↓
Domain Services
      ↓
SQLite / Hardware / Sync
```

## Important Security Rule

The React renderer must NOT directly:

- Access Node.js
- Access the filesystem
- Access SQLite
- Access hardware
- Execute arbitrary shell commands

All privileged operations must go through a restricted preload/API bridge.

---

# 6. Functional Requirements

# FR-001 — Application Installation

Muneem shall provide a desktop installer for Windows.

The installer shall:

- Install Muneem
- Create required local directories
- Initialize the local database
- Generate a unique device ID
- Register the device
- Create shortcuts
- Support application updates

Future platforms:

- macOS
- Linux

---

# FR-002 — User Registration

Users shall be able to create a Muneem account using:

- Mobile number
- Email
- Password
- OTP

---

# FR-003 — Login

Users shall be able to log in using:

- Mobile/email
- Password
- OTP

---

# FR-004 — Offline Login

Previously authenticated users shall be able to access the local Muneem installation while offline.

Authentication data must be stored securely.

---

# FR-005 — Device Registration

Each installation shall have a unique:

```text
Organization ID
Business ID
Device ID
Installation ID
User ID
```

Users shall be able to view and revoke registered devices.

---

# FR-006 — Business Creation

User shall create a business with:

- Business name
- Legal name
- Business type
- Address
- State
- City
- PIN code
- Phone
- Email
- GSTIN
- PAN
- Logo
- Financial year

---

# FR-007 — Business Types

Support:

- Retail
- Wholesale
- Distribution
- Service
- Restaurant
- Trading
- Other

---

# FR-008 — GST Configuration

Business shall configure:

- GST registration status
- GSTIN
- State
- Tax scheme
- Default tax rates
- Invoice settings

---

# FR-009 — Multi-Business

A user may own/manage multiple businesses.

Business data must remain isolated.

---

# FR-010 — Branch Management

Businesses may create multiple branches.

Each branch shall support:

- Name
- Address
- GSTIN if applicable
- Warehouse
- Invoice series
- POS terminals

Example:

```text
Muneem Business
├── Delhi Store
├── Gurgaon Store
└── Noida Store
```

---

# FR-011 — User Management

Admin can create:

- Owner
- Manager
- Cashier
- Accountant
- Inventory Manager
- Salesperson

---

# FR-012 — Role-Based Permissions

Permissions shall be configurable for:

- Sales
- Purchases
- Inventory
- Customers
- Suppliers
- Payments
- Expenses
- Accounting
- Reports
- Settings
- User management
- Discounts
- Refunds
- Price changes

---

# FR-013 — Approval Controls

Admin can require approval for:

- Large discounts
- Refunds
- Stock adjustments
- Purchase cancellation
- Invoice cancellation
- Credit-limit changes

---

# FR-014 — Product Creation

Products shall support:

- Product name
- SKU
- Barcode
- HSN/SAC
- Category
- Brand
- Unit
- Purchase price
- Selling price
- MRP
- GST rate
- Discount
- Reorder level
- Supplier
- Product image

---

# FR-015 — Multiple Barcodes

A product may have multiple barcodes.

---

# FR-016 — Product Variants

Support:

- Size
- Color
- Weight
- Model
- Pack size

---

# FR-017 — Bulk Import

Products can be imported through:

- CSV
- XLSX

Import must provide:

- Validation
- Preview
- Error reporting
- Duplicate handling
- Import summary

---

# FR-018 — Product Search

Search by:

- Name
- SKU
- Barcode
- HSN
- Brand

Search must work offline.

---

# FR-019 — Stock Tracking

Muneem shall track:

```text
Opening Stock
+ Purchases
+ Stock Transfers In
+ Stock Adjustments
- Sales
- Stock Transfers Out
- Returns
- Damaged Stock
= Closing Stock
```

---

# FR-020 — Multiple Warehouses

Support multiple warehouses per business.

---

# FR-021 — Stock Transfer

Users can transfer stock between:

- Stores
- Warehouses
- Branches

---

# FR-022 — Stock Adjustment

Users can adjust stock with mandatory reason.

Reasons:

- Damage
- Theft
- Expiry
- Counting error
- Opening stock
- Other

---

# FR-023 — Low Stock Alerts

Muneem shall notify users when stock falls below reorder level.

---

# FR-024 — Stock History

Every inventory movement must be traceable.

Example:

```text
Product
  ↓
Purchase +50
  ↓
Transfer -10
  ↓
Sale -5
  ↓
Adjustment -2
  ↓
Current Stock 33
```

---

# FR-025 — Batch and Serial Numbers

Products may optionally support:

- Batch numbers
- Expiry dates
- Serial numbers

---

# FR-026 — Barcode Scanner

Muneem shall support:

- USB barcode scanners
- Bluetooth scanners
- Keyboard-emulation scanners
- Serial scanners where supported

A scan should immediately add the product to the active cart.

---

# FR-027 — Barcode Generation

Muneem shall support barcode generation and label printing.

---

# FR-028 — POS Screen

POS shall provide a fast billing interface.

Cashier workflow:

1. Scan product
2. Add product
3. Change quantity
4. Apply discount
5. Calculate tax
6. Select customer
7. Select payment
8. Complete sale
9. Print receipt

---

# FR-029 — Keyboard Shortcuts

POS shall support keyboard-first workflows.

Example defaults:

```text
F2  Search Product
F3  Customer
F4  Discount
F5  Payment
F6  Hold Bill
F7  Retrieve Bill
F8  Return
F9  Print
Esc Cancel
```

Shortcuts should be configurable in the future.

---

# FR-030 — Hold Bills

Cashier can hold an incomplete bill and retrieve it later.

---

# FR-031 — Multiple Payment Methods

Support:

- Cash
- UPI
- Card
- Bank transfer
- Credit
- Mixed payment

Example:

```text
Total: ₹1,000

Cash   ₹400
UPI    ₹400
Credit ₹200
```

---

# FR-032 — POS Register

Each POS terminal shall support register sessions.

Opening:

```text
Opening Cash: ₹10,000
```

During session:

```text
Sales
Refunds
Cash In
Cash Out
Expenses
```

Closing:

```text
Expected Cash
Actual Cash
Difference
```

---

# FR-033 — Tax Invoices

Muneem shall generate:

- Tax invoices
- Retail invoices
- Wholesale invoices
- Credit invoices

---

# FR-034 — Invoice Content

Invoice shall include:

- Business information
- GSTIN
- Invoice number
- Date/time
- Customer
- Product
- Quantity
- Rate
- Discount
- Taxable value
- CGST
- SGST
- IGST
- Total
- Payment method

---

# FR-035 — Invoice Numbering

Support configurable invoice series.

Example:

```text
INV-2026-000001
INV-2026-000002
```

Different branches may have different series.

---

# FR-036 — Invoice Printing

Support:

- A4 printers
- 58mm thermal printers
- 80mm thermal printers

Templates shall be configurable.

---

# FR-037 — Invoice Sharing

Invoices can be:

- Printed
- Generated as PDF
- Saved
- Shared
- Emailed

---

# FR-038 — Customer Management

Customer profile shall contain:

- Name
- Phone
- Email
- Address
- GSTIN
- Credit limit
- Opening balance

---

# FR-039 — Customer Ledger

Customer ledger shall show:

```text
Invoice
Payment
Credit Note
Debit
Outstanding
```

---

# FR-040 — Customer Credit

Support:

- Credit sales
- Credit limits
- Outstanding balance
- Due dates
- Payment history
- Payment reminders

---

# FR-041 — Sales Returns

Users can return products against an invoice.

System shall:

- Reference original invoice
- Validate returned quantity
- Increase stock
- Reverse applicable accounting entries
- Calculate tax adjustment
- Generate credit note where applicable

---

# FR-042 — Supplier Management

Supplier records shall contain:

- Name
- Phone
- Email
- Address
- GSTIN
- Opening balance
- Credit terms

---

# FR-043 — Purchasing

Support:

- Purchase orders
- Purchase invoices
- Purchase returns
- Supplier payments

Workflow:

```text
Purchase Order
      ↓
Goods Received
      ↓
Purchase Invoice
      ↓
Stock Increase
      ↓
Supplier Payable
```

---

# FR-044 — Purchase Returns

Support supplier returns.

System shall:

- Reduce stock
- Reduce payable
- Record tax impact
- Maintain audit trail

---

# FR-045 — Expenses

Users can record expenses.

Examples:

- Rent
- Electricity
- Salary
- Transport
- Internet
- Repairs
- Office expenses

Expense fields:

- Date
- Amount
- Category
- Payment method
- Vendor
- Notes
- Attachment

---

# FR-046 — GST

Muneem shall support:

- CGST
- SGST
- IGST
- UTGST where applicable
- GST-inclusive pricing
- GST-exclusive pricing
- HSN/SAC
- GST rates
- Taxable value
- Input tax
- Output tax

GST calculations must be deterministic and auditable.

---

# FR-047 — GST Reporting

Muneem shall maintain GST transaction records required for reporting.

Reports shall be designed around applicable Indian GST requirements at implementation time.

---

# FR-048 — E-Invoice

Muneem shall support integration with the applicable Indian e-invoice system.

Capabilities:

- Generate IRN
- Generate QR code
- Store IRN
- Store acknowledgement
- Handle API errors
- Retry failed requests
- Maintain request/response audit trail

Implementation must follow current government API requirements.

---

# FR-049 — E-Way Bill

Support e-way bill generation where applicable.

Store:

- E-way bill number
- Date
- Validity
- Transport information
- Vehicle number
- Distance
- Reference invoice

---

# FR-050 — Chart of Accounts

Provide default accounts for:

```text
Assets
Liabilities
Income
Expenses
Equity
```

---

# FR-051 — Ledger

Every financial transaction shall create appropriate ledger entries.

---

# FR-052 — Double Entry Accounting

Accounting engine must enforce:

```text
Total Debit = Total Credit
```

for every journal transaction.

---

# FR-053 — Journal Entries

Support:

- Manual journal
- Sales journal
- Purchase journal
- Payment
- Receipt
- Expense
- Transfer
- Adjustment

---

# FR-054 — Financial Reports

Muneem shall provide:

- Profit & Loss
- Balance Sheet
- Trial Balance
- Cash Book
- Bank Book
- General Ledger
- Customer Ledger
- Supplier Ledger
- Sales Report
- Purchase Report
- Expense Report
- GST Report
- Outstanding Receivables
- Outstanding Payables
- Stock Valuation
- Stock Movement
- Daily Sales
- Monthly Sales

Reports must support:

- Date filtering
- Branch filtering
- Export
- Print
- PDF

---

# FR-055 — Payments

Record:

- Customer receipts
- Supplier payments
- Expenses
- Refunds

---

# FR-056 — Payment Allocation

Payments must support allocation.

Example:

```text
Customer Payment ₹10,000

Invoice A ₹6,000
Invoice B ₹4,000
```

Allocated amount must never exceed the payment amount.

---

# FR-057 — Bank Accounts

Users can configure:

- Bank account
- Account number
- IFSC
- Opening balance

---

# FR-058 — Manual Bank Transactions

Support manual:

- Deposits
- Withdrawals
- Transfers
- Charges
- Adjustments

Future:

- Automated bank feeds
- Bank reconciliation

---

# FR-059 — Hardware Manager

Muneem shall provide a unified hardware abstraction layer.

```text
HardwareManager
├── BarcodeScannerManager
├── PrinterManager
├── CashDrawerManager
├── WeighingScaleManager
├── LabelPrinterManager
└── CustomerDisplayManager
```

---

# FR-060 — Printer Support

Support:

- USB printers
- Network printers
- Thermal printers
- A4 printers

The hardware layer should expose a common printer interface.

---

# FR-061 — Cash Drawer

Cash drawer may automatically open after eligible cash transactions.

Hardware failure must never invalidate a completed transaction.

---

# FR-062 — Weighing Scale

Support compatible weighing scales.

Example:

```text
Scale
  ↓
1.250 kg
  ↓
Muneem
  ↓
Product ₹100/kg
  ↓
₹125
```

---

# FR-063 — Offline Mode

Core operations must continue without internet:

- Login for previously authenticated users
- Product lookup
- Barcode scanning
- POS
- Invoice creation
- Printing
- Inventory updates
- Customer lookup
- Payment recording
- Purchase entry
- Expense entry
- Basic reports

---

# FR-064 — Local Transaction ID

Every offline transaction shall receive a globally unique transaction ID.

Recommended structure:

```text
organization_id
device_id
transaction_id
local_sequence
created_at
```

The ID must remain stable through synchronization.

---

# FR-065 — Local Transaction Persistence

A transaction must be committed to local storage before the POS considers the transaction completed.

Printing is not part of the transaction commit.

Correct sequence:

```text
Calculate
  ↓
Validate
  ↓
Commit Transaction
  ↓
Update Local Inventory
  ↓
Update Local Accounting
  ↓
Print Receipt
  ↓
Queue Sync
```

---

# FR-066 — Synchronization

Muneem shall automatically synchronize local changes with the cloud.

```text
LOCAL TRANSACTION
       ↓
LOCAL DATABASE
       ↓
SYNC OUTBOX
       ↓
CLOUD API
       ↓
POSTGRESQL
```

---

# FR-067 — Sync Retry

Sync shall automatically retry failed operations.

Retry strategy shall support:

- Exponential backoff
- Retry limits
- Dead-letter handling
- Error classification

---

# FR-068 — Sync Status

Application shall expose sync status.

Examples:

```text
✓ Synced

⟳ Syncing 12 transactions

⚠ 3 transactions waiting

✕ Sync error
```

---

# FR-069 — Automatic Synchronization

Users should not need to press a manual sync button for normal operation.

---

# FR-070 — Conflict Resolution

Muneem shall detect conflicts involving:

- Product changes
- Price changes
- Customer changes
- Inventory
- Payments
- Master data

Financial transactions must never silently overwrite each other.

Conflict resolution must be deterministic and auditable.

---

# FR-071 — Cloud Backup

Cloud shall automatically maintain encrypted backups.

Users shall be able to:

- View backup status
- Restore business data
- Download business backup where permitted

---

# FR-072 — Dashboard

Dashboard shall display:

- Today's sales
- Today's purchases
- Cash
- UPI
- Credit sales
- Outstanding receivables
- Outstanding payables
- Low-stock products
- Top-selling products
- Expenses
- Profit indicators

Dashboard must work from local data while offline.

---

# FR-073 — Global Search

Global search shall support:

- Products
- Customers
- Suppliers
- Invoices
- Payments
- Purchases

Search must work offline for locally available data.

---

# FR-074 — Notifications

Support:

- Low stock
- Customer payment due
- Supplier payment due
- Failed sync
- Backup failure
- Invoice errors
- E-invoice errors
- License/subscription notifications

---

# FR-075 — Document Attachments

Users can attach documents/images to:

- Customers
- Suppliers
- Products
- Purchases
- Expenses
- Invoices

Documents shall be stored locally when offline and uploaded when connectivity is available.

---

# FR-076 — Import

Import:

- Products
- Customers
- Suppliers
- Opening stock
- Opening balances
- Supported historical transactions

Formats:

- CSV
- XLSX

---

# FR-077 — Export

Export:

- CSV
- XLSX
- PDF

---

# FR-078 — Audit Trail

Muneem shall maintain an immutable audit log.

Track:

- Login
- Logout
- Invoice creation
- Invoice modification
- Invoice cancellation
- Payment
- Refund
- Stock adjustment
- Price change
- User creation
- Permission change
- Configuration change

Each record shall include:

```text
User
Device
Timestamp
Action
Entity
Entity ID
Previous Value
New Value
```

---

# FR-079 — Invoice Cancellation

Cancelled invoices shall not be physically deleted.

Instead:

```text
Invoice
  ↓
Cancelled
  ↓
Cancellation Reason
  ↓
Audit Record
```

---

# FR-080 — Financial Record Deletion

Financial transactions must not be hard deleted through normal UI workflows.

Use:

- Cancellation
- Reversal
- Credit note
- Debit note
- Adjustment

as appropriate.

---

# FR-081 — Recurring Transactions

Phase 2:

- Recurring invoices
- Recurring expenses
- Payment reminders
- Subscription billing

---

# FR-082 — Mobile Application

Phase 2/3.

Mobile application may provide:

- Sales dashboard
- Inventory lookup
- Customer lookup
- Payment collection
- Reports
- Notifications
- Business monitoring

POS remains primarily desktop.

---

# FR-083 — Web Application

Phase 2.

Web application may provide:

- Business administration
- Reports
- Accounting
- Inventory
- User management
- Multi-branch management
- Remote monitoring

---

# FR-084 — AI Assistant

Phase 3.

Potential capabilities:

- Natural-language reports
- Sales insights
- Low-stock prediction
- Expense classification
- Invoice OCR
- Product import from images
- Anomaly detection
- Cash-flow insights
- Business assistant

Example:

> "What were my top 10 products this month?"

AI must only access data the authenticated user is authorized to access.

---

# 7. MVP Scope

The first production version should focus on the following.

```text
1. Business setup
2. User/RBAC
3. Products
4. Customers
5. Suppliers
6. Barcode scanning
7. POS billing
8. Thermal printing
9. Cash drawer
10. Purchases
11. Inventory
12. Customer credit
13. Payments
14. GST
15. Basic invoices
16. Basic accounting
17. Basic reports
18. Offline operation
19. Cloud synchronization
20. Backup
21. Audit log
22. Import/export
```

---

# 8. MVP POS Golden Workflow

```text
OPEN MUNEEM
      ↓
OPEN REGISTER
      ↓
SCAN BARCODE
      ↓
PRODUCT ADDED
      ↓
SCAN MORE
      ↓
SELECT CUSTOMER
      ↓
DISCOUNT
      ↓
GST
      ↓
PAYMENT
      ↓
TRANSACTION SAVED LOCALLY
      ↓
RECEIPT PRINTED
      ↓
CASH DRAWER OPENS
      ↓
INVENTORY UPDATED
      ↓
ACCOUNTING UPDATED
      ↓
SYNC TO CLOUD
```

The workflow must continue if internet connectivity disappears.

---

# 9. Non-Functional Requirements

# NFR-001 — Performance

Target local performance:

- Product lookup: <100ms
- Barcode-to-product lookup: <100ms
- Cart update: <100ms
- Invoice calculation: <100ms
- Invoice save: <200ms
- Local transaction commit: <300ms
- Application startup: target <3 seconds on supported hardware

Actual printer latency is hardware-dependent.

---

# NFR-002 — Cloud Availability

Target cloud availability:

**99.9%+**

Core desktop operations must remain usable during cloud outages.

---

# NFR-003 — Data Integrity

The system must never lose a committed financial transaction.

Transactions must be:

- Atomic
- Durable
- Idempotent
- Auditable

---

# NFR-004 — Financial Precision

Never use binary floating-point arithmetic for monetary calculations.

Use:

- Decimal arithmetic
- Integer minor units where appropriate

Example:

```text
₹100.25
```

must never become:

```text
₹100.249999
```

---

# NFR-005 — Security

Muneem shall implement:

- TLS for network communication
- Encryption at rest where appropriate
- Secure local credential storage
- OS credential/keychain storage
- Password hashing
- Token rotation
- Device authentication
- RBAC
- Audit logging
- Rate limiting
- Session management

---

# NFR-006 — Electron Security

Electron must use secure defaults.

Requirements:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` where compatible
- Restricted preload API
- No arbitrary renderer-to-main IPC
- Validate all IPC payloads
- Do not expose raw Node APIs to renderer
- Do not expose filesystem access directly
- Do not execute arbitrary shell commands from renderer
- Restrict navigation
- Validate external URLs
- Use Content Security Policy
- Keep Electron updated

---

# NFR-007 — Local Database Security

SQLite must be protected from unauthorized access.

Sensitive secrets must not be stored as plaintext.

Use OS-secured credential storage for:

- Authentication tokens
- Encryption keys
- Device credentials
- Refresh tokens

---

# NFR-008 — Multi-Tenant Security

Cloud data must be isolated by:

```text
Organization
 ↓
Business
 ↓
Branch
 ↓
User
```

Every API request must be authorized against the user's organization and business permissions.

---

# NFR-009 — Sync Reliability

Sync operations must be:

- Idempotent
- Retryable
- Persistent
- Observable
- Ordered where business rules require ordering

A failed sync must never delete or invalidate the local transaction.

---

# NFR-010 — Backup and Disaster Recovery

Cloud infrastructure shall provide:

- Automated backups
- Point-in-time recovery where supported
- Backup monitoring
- Recovery procedures
- Disaster recovery testing

Initial targets:

**RPO:** ≤15 minutes for synchronized cloud data

**RTO:** ≤4 hours

---

# NFR-011 — Observability

System must provide:

- Application logs
- Cloud logs
- Sync logs
- Error tracking
- Performance metrics
- API metrics
- Hardware diagnostics
- Database health
- Backup health

---

# NFR-012 — Hardware Reliability

Hardware failures must not corrupt transactions.

Example:

```text
Invoice saved
     ↓
Printer fails
     ↓
Invoice remains saved
     ↓
User retries printing
```

Successful transaction completion must never depend on successful printing.

---

# NFR-013 — Automatic Updates

Desktop application shall support automatic updates.

Updates must:

- Preserve local data
- Verify package integrity
- Support interrupted downloads
- Support rollback where practical
- Provide version information
- Allow controlled rollout

---

# NFR-014 — Localization

Initial languages:

- English
- Hindi

Architecture must support additional Indian languages.

Future:

- Marathi
- Gujarati
- Punjabi
- Bengali
- Tamil
- Telugu
- Kannada
- Malayalam

---

# NFR-015 — Currency

Initial currency:

**Indian Rupee (INR)**

Architecture should allow future multi-currency support.

---

# NFR-016 — Date and Time

All transaction timestamps shall be stored consistently.

System must account for:

- Local timezone
- Financial year
- Device clock differences
- Server timestamps

---

# NFR-017 — Auditability

Financial records must remain traceable from:

```text
POS Sale
   ↓
Invoice
   ↓
Payment
   ↓
Inventory Movement
   ↓
Ledger Entries
   ↓
GST Transaction
```

---

# 10. Electron Desktop Architecture

```text
┌──────────────────────────────────────────┐
│              Electron App               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         React Renderer             │  │
│  │                                    │  │
│  │ POS / Inventory / Reports / UI     │  │
│  └────────────────┬───────────────────┘  │
│                   │                      │
│             Secure IPC API               │
│                   │                      │
│  ┌────────────────▼───────────────────┐  │
│  │          Preload Layer             │  │
│  │       Restricted Bridge            │  │
│  └────────────────┬───────────────────┘  │
│                   │                      │
│  ┌────────────────▼───────────────────┐  │
│  │        Electron Main Process       │  │
│  │                                    │  │
│  │ Application Services               │  │
│  │ Domain Services                    │  │
│  │ Sync Engine                        │  │
│  │ Database Service                   │  │
│  │ Hardware Manager                   │  │
│  │ Update Manager                     │  │
│  └─────────┬──────────────┬───────────┘  │
│            │              │              │
│       ┌────▼────┐    ┌────▼────────┐     │
│       │ SQLite  │    │  Hardware   │     │
│       └─────────┘    └─────────────┘     │
└──────────────────────────────────────────┘
```

---

# 11. Hardware Abstraction Layer

Hardware must never be tightly coupled to the POS UI.

## Interfaces

```text
PrinterInterface
ScannerInterface
CashDrawerInterface
ScaleInterface
DisplayInterface
LabelPrinterInterface
```

## Hardware Manager

```text
HardwareManager
├── BarcodeScannerManager
├── PrinterManager
├── CashDrawerManager
├── WeighingScaleManager
├── LabelPrinterManager
└── CustomerDisplayManager
```

## Adapter Model

```text
Hardware Interface
       ↓
Adapter
       ↓
Manufacturer / Protocol
```

Potential adapters:

```text
EpsonAdapter
ZebraAdapter
HoneywellAdapter
TVSAdapter
GenericUSBAdapter
NetworkPrinterAdapter
SerialDeviceAdapter
```

---

# 12. Hardware Support Roadmap

## Tier 1 — MVP

- USB barcode scanner
- Bluetooth barcode scanner
- 80mm thermal printer
- 58mm thermal printer
- Cash drawer

## Tier 2

- Label printer
- Weighing scale
- Customer display

## Tier 3

- RFID
- Biometric devices
- POS terminals
- Advanced serial devices

---

# 13. Local-First Data Model

SQLite should contain sufficient information for the business to operate offline.

Minimum local data:

- Products
- Product variants
- Barcodes
- Customers
- Suppliers
- Tax configuration
- Pricing
- Inventory
- Warehouses
- POS configuration
- Users/permissions required for offline operation
- Recent transactions
- Current register session
- Sync outbox
- Sync metadata

---

# 14. Cloud Data Model

PostgreSQL should contain:

- Organizations
- Businesses
- Branches
- Users
- Roles
- Permissions
- Products
- Customers
- Suppliers
- Inventory
- Transactions
- Accounting
- GST
- E-invoice records
- E-way bill records
- Payments
- Audit logs
- Documents
- Devices
- Sync metadata
- Subscriptions
- Usage

---

# 15. Core Domain Modules

The application should be organized into clear modules:

```text
auth
business
users
roles
products
inventory
customers
suppliers
pos
sales
purchases
payments
expenses
gst
accounting
reports
hardware
sync
notifications
audit
documents
settings
```

Start as a modular monolith.

Do not introduce microservices prematurely.

---

# 16. Core Data Entities

Minimum entities:

```text
User
Organization
Business
Branch
Device
Role
Permission

Product
ProductVariant
Category
Brand
Unit
Barcode

Customer
Supplier

Warehouse
Stock
StockMovement
Batch
SerialNumber

POSRegister
POSSession
Cart
Sale
SaleItem
Invoice
InvoiceItem
CreditNote

Purchase
PurchaseItem
PurchaseInvoice
DebitNote

Payment
PaymentAllocation

Account
JournalEntry
JournalEntryLine
LedgerEntry

Tax
GSTTransaction
EInvoice
EWayBill

Expense

AuditLog
SyncOperation
Notification
Document
```

---

# 17. Accounting Invariants

## Double Entry

```text
SUM(debits) = SUM(credits)
```

for every posted journal.

## Invoice

```text
Subtotal
- Discount
+ Tax
= Total
```

## Inventory

```text
Opening
+ Purchases
+ Transfers In
- Sales
- Transfers Out
- Returns
- Adjustments
= Closing
```

## Payment

```text
Allocated Amount <= Payment Amount
```

## Credit Note

Must reference the applicable original transaction.

---

# 18. Transaction Architecture

A sale should be represented as an immutable business transaction.

Example:

```text
SALE_CREATED
PAYMENT_CREATED
STOCK_DECREASED
LEDGER_POSTED
INVOICE_CREATED
```

Do not rely only on the current inventory number.

Maintain transaction history so the system can reconstruct and audit changes.

---

# 19. Offline Transaction Lifecycle

```text
User Action
    ↓
Validate
    ↓
Create Transaction ID
    ↓
Write Local Transaction
    ↓
Write Inventory Movement
    ↓
Write Accounting Entries
    ↓
Write Sync Outbox Record
    ↓
Commit SQLite Transaction
    ↓
Print Receipt
    ↓
Cloud Sync
```

The local database commit is the point at which the transaction becomes durable.

---

# 20. Synchronization Architecture

## Outbox Pattern

Every cloud-synchronizable local operation shall create an outbox entry.

```text
Business Transaction
        ↓
SQLite Transaction
        ↓
Sync Outbox
        ↓
Sync Worker
        ↓
Cloud API
        ↓
PostgreSQL
```

## Sync Operation

Recommended fields:

```text
operation_id
organization_id
business_id
device_id
entity_type
entity_id
operation_type
payload
sequence
created_at
attempt_count
last_attempt_at
status
error_code
error_message
```

---

# 21. Conflict Strategy

## Financial Transactions

Never use last-write-wins for financial transactions.

Use:

- Immutable transaction IDs
- Idempotency keys
- Business validation
- Explicit reversal/correction
- Audit records

## Master Data

For simple master data such as product descriptions:

- Version numbers
- Updated timestamps
- Conflict detection
- Controlled merge rules

## Inventory

Inventory should be derived from stock movements rather than blindly overwriting stock quantities.

---

# 22. POS Transaction Reliability

Required sequence:

```text
Cart
 ↓
Validate
 ↓
Calculate
 ↓
Commit sale
 ↓
Commit payment
 ↓
Commit inventory movement
 ↓
Commit ledger entries
 ↓
Commit sync outbox
 ↓
Return success to UI
 ↓
Print
```

The entire financial transaction should be atomic locally.

---

# 23. Database Requirements

## SQLite

Requirements:

- WAL mode
- Foreign keys enabled
- Transactions for all financial operations
- Database migrations
- Schema versioning
- Integrity checks
- Recovery handling
- Backup/export capability

## PostgreSQL

Requirements:

- Strong relational integrity
- Foreign keys
- Transactions
- Constraints
- Indexing
- Partitioning strategy where needed
- Point-in-time recovery
- Tenant isolation strategy

---

# 24. Search Requirements

Local search must be optimized for POS.

Search should support:

- Exact barcode lookup
- Prefix product lookup
- Product name
- SKU
- Alternate barcode
- Customer phone
- Customer name

Barcode lookup should use indexed exact-match queries.

---

# 25. Reporting Architecture

Reports should be based on authoritative business transactions.

Initial reports:

- Daily sales
- Monthly sales
- Product sales
- Purchase report
- Stock report
- Stock valuation
- Customer outstanding
- Supplier outstanding
- Cash report
- Payment report
- Expense report
- GST report
- Profit & Loss
- Ledger
- Trial Balance

Offline reports use local data.

Cloud reports use synchronized data.

---

# 26. Security Model

## Desktop

Renderer:

```text
No Node
No filesystem
No raw hardware access
No arbitrary shell
```

Preload:

```text
Explicit APIs only
```

Main process:

```text
Privileged operations
```

## Cloud

Every request must include authenticated identity and authorization context.

Authorization should validate:

```text
User
→ Organization
→ Business
→ Branch
→ Permission
```

---

# 27. Electron IPC Design

Use explicit methods such as:

```text
products.search()
sales.create()
sales.get()
customers.search()
payments.create()
inventory.getStock()
hardware.getDevices()
printer.printInvoice()
cashDrawer.open()
sync.getStatus()
sync.retry()
settings.get()
```

Do NOT expose:

```text
executeSQL()
executeShell()
readAnyFile()
writeAnyFile()
```

to the renderer.

---

# 28. Hardware Failure Rules

Example:

```text
Sale created
   ↓
Receipt printer disconnected
   ↓
Sale remains completed
   ↓
UI shows "Printer unavailable"
   ↓
User can retry printing
```

Hardware errors must never roll back an already committed financial transaction.

---

# 29. Backup Strategy

## Local

Support:

- Automatic local database backup
- Rolling backup copies
- Backup integrity validation
- Recovery procedure

## Cloud

Support:

- Automated backups
- Point-in-time recovery
- Disaster recovery
- Backup monitoring

---

# 30. Application Update Strategy

Use signed application packages.

Update flow:

```text
Check Update
    ↓
Download
    ↓
Verify Signature
    ↓
Stage Update
    ↓
Restart
    ↓
Migrate Database
    ↓
Validate
    ↓
Start Application
```

Database migrations must be backward-safe where practical.

---

# 31. Crash Recovery

If the application terminates unexpectedly:

1. SQLite transaction must roll back incomplete transactions.
2. Committed transactions must remain.
3. Sync outbox must remain.
4. On next startup, Muneem must validate local database state.
5. Failed sync operations must resume.
6. The user should see any unresolved operational issue.

---

# 32. Data Migration

Muneem must provide import tools for businesses migrating from:

- Excel
- CSV
- Existing billing software
- Other supported accounting exports

Migration wizard:

```text
Upload
  ↓
Detect Columns
  ↓
Map Fields
  ↓
Validate
  ↓
Preview
  ↓
Import
  ↓
Summary
```

---

# 33. User Experience Requirements

The POS must prioritize:

- Speed
- Minimal clicks
- Keyboard operation
- Barcode scanning
- Clear totals
- Clear payment state
- Large touch-friendly controls where appropriate
- Error prevention
- Fast recovery

A cashier should not need to navigate through accounting screens to make a normal sale.

---

# 34. Dashboard Requirements

Primary dashboard cards:

```text
Today's Sales
Today's Transactions
Cash
UPI
Credit
Outstanding
Low Stock
Purchases
Expenses
```

Additional charts:

- Sales trend
- Payment method breakdown
- Top products
- Category performance
- Stock alerts

---

# 35. Permissions Matrix

Example:

| Capability | Owner | Manager | Cashier | Accountant | Inventory |
|---|---:|---:|---:|---:|---:|
| POS Sale | Yes | Yes | Yes | Optional | Optional |
| Refund | Yes | Yes | Configurable | No | No |
| Discount | Yes | Yes | Configurable | No | No |
| Product Edit | Yes | Yes | No | No | Yes |
| Purchase | Yes | Yes | No | Yes | Yes |
| Stock Adjustment | Yes | Yes | No | No | Yes |
| Accounting | Yes | Optional | No | Yes | No |
| Reports | Yes | Yes | Limited | Yes | Limited |
| User Management | Yes | Optional | No | No | No |
| Settings | Yes | Optional | No | No | No |

Exact permissions should be configurable.

---

# 36. MVP Acceptance Criteria

## POS

A user can:

1. Log in
2. Open register
3. Scan product
4. Add multiple products
5. Change quantity
6. Apply discount
7. Select customer
8. Select payment
9. Complete sale
10. Print receipt
11. Update inventory
12. Create accounting entries
13. Sync to cloud

## Offline

The same flow must work with:

```text
Internet disconnected
```

## Recovery

After:

```text
Application restart
Computer restart
Internet outage
Printer failure
```

the transaction must remain recoverable.

---

# 37. Critical End-to-End Test

The system must prove the following scenario before MVP production release:

```text
Internet ON
   ↓
Create sale
   ↓
Internet OFF
   ↓
Create 100 sales
   ↓
Print receipts
   ↓
Update inventory
   ↓
Restart computer
   ↓
Create more sales
   ↓
Internet ON
   ↓
Synchronize
   ↓
Verify cloud
   ↓
Verify accounting
   ↓
Verify inventory
   ↓
Verify payments
   ↓
Verify audit trail
```

Expected result:

- No lost transaction
- No duplicate transaction
- No silently overwritten transaction
- No incorrect stock
- No incorrect accounting
- No incorrect payment
- No broken audit trail

---

# 38. Future Features

## Phase 2 — Business Management

- Advanced accounting
- Advanced GST
- E-invoice
- E-way bill
- Multi-branch
- Advanced reports
- Bank reconciliation
- Mobile app
- Web dashboard
- Recurring invoices
- Advanced purchasing

## Phase 3 — Business OS

- CRM
- E-commerce
- Payroll
- Advanced automation
- AI
- OCR
- Business intelligence
- Public API
- Webhooks
- Marketplace integrations

---

# 39. Features Explicitly Out of MVP

Do not build initially:

- Full CRM
- Payroll
- Manufacturing ERP
- HR
- Project management
- Help desk
- Full e-commerce platform
- Complex subscription billing
- Enterprise workflow engine
- Advanced BI
- Large marketplace integrations
- Advanced AI

---

# 40. Product Differentiation

Muneem should differentiate through:

## 1. Offline-first

The shop keeps working without internet.

## 2. Hardware-native

Scanner, printer, drawer and weighing scale work naturally.

## 3. Extremely fast billing

Barcode → cart → payment → receipt in seconds.

## 4. One application

```text
POS
+
Inventory
+
Purchasing
+
GST
+
Accounting
```

## 5. Indian-first

Indian GST, UPI, tax workflows, hardware and SMB workflows are first-class.

---

# 41. Positioning

## Internal Positioning

> Muneem is the offline-first operating system for Indian retail businesses.

## Customer-facing Positioning

> Billing, inventory and accounts that keep working—even when the internet doesn't.

## Initial Product Promise

> Install Muneem. Connect your scanner and printer. Import your products. Start billing.

---

# 42. Success Metrics

## Activation

Percentage of businesses completing:

```text
Install
→ Business setup
→ Product import
→ Hardware setup
→ First invoice
```

## Transaction Adoption

Track:

- Daily active businesses
- Bills/day
- Transactions/business/day
- Products sold/day
- Hardware transactions/day

## Reliability

Track:

- Offline transaction success
- Sync success rate
- Sync latency
- Printer failure rate
- Crash rate
- Database recovery rate

## Retention

Track:

- Day 7
- Day 30
- Day 90

## Business Metrics

Track:

- MRR
- ARPU
- CAC
- Churn
- Paid conversion
- Active businesses
- Transactions/business

---

# 43. Recommended Development Strategy

## Stage 1 — Foundation

Build:

- Electron shell
- React application
- Secure preload bridge
- SQLite
- Database migrations
- Authentication
- Business setup
- Device identity
- Logging
- Error handling

## Stage 2 — POS

Build:

- Product database
- Barcode scanning
- Cart
- Discounts
- GST calculation
- Payment
- Invoice
- Thermal printing
- Cash drawer
- POS sessions

## Stage 3 — Inventory

Build:

- Stock
- Warehouses
- Purchases
- Transfers
- Adjustments
- Low-stock alerts

## Stage 4 — Accounting

Build:

- Chart of accounts
- Journal engine
- Ledger
- Customer ledger
- Supplier ledger
- P&L
- Trial balance

## Stage 5 — Offline Sync

Build:

- Outbox
- Sync worker
- Idempotency
- Retry
- Conflict detection
- Cloud API
- PostgreSQL synchronization

## Stage 6 — Cloud

Build:

- Cloud dashboard
- Backups
- Multi-device
- Multi-branch
- Remote reports

## Stage 7 — Production Hardening

Test:

- Power failure
- Database corruption
- Internet failure
- Printer failure
- Hardware disconnect
- Application crash
- Duplicate requests
- Sync conflicts
- Large datasets
- Concurrent users
- Long offline periods

---

# 44. Claude Board Implementation Directive

Use this PRD as the source of truth.

Claude should produce these artifacts in order:

1. System architecture
2. Domain architecture
3. Complete ERD
4. SQLite schema
5. PostgreSQL schema
6. Database migration strategy
7. Offline synchronization protocol
8. Conflict-resolution strategy
9. Accounting engine design
10. Inventory engine design
11. GST engine design
12. POS architecture
13. Hardware abstraction layer
14. Printer architecture
15. Barcode scanner integration
16. Cash drawer integration
17. Weighing scale integration
18. Electron security architecture
19. Preload/IPC API specification
20. Authentication architecture
21. RBAC model
22. Audit architecture
23. Queue/event architecture
24. Backup architecture
25. Observability architecture
26. API specification
27. Testing strategy
28. CI/CD
29. Electron auto-update architecture
30. MVP implementation plan
31. Feature acceptance criteria
32. Production deployment architecture

---

# 45. Engineering Constraints

## Constraint 1 — Electron

Use Electron as the desktop runtime.

## Constraint 2 — Secure Renderer

React renderer must not have direct Node.js access.

## Constraint 3 — Local First

Core POS operations must use SQLite locally.

## Constraint 4 — Cloud Optional for Core POS

Internet must not be required to complete normal POS transactions.

## Constraint 5 — Modular Architecture

Start with a modular monolith.

Do not create microservices without a concrete scaling requirement.

## Constraint 6 — Transaction Integrity

Every financial transaction must be atomic and auditable.

## Constraint 7 — Hardware Abstraction

Do not hard-code hardware vendors into business logic.

## Constraint 8 — Sync as a First-Class System

Synchronization must be designed from the beginning rather than added after the POS is complete.

## Constraint 9 — No Data Loss

A committed transaction must survive:

- Application crash
- Computer restart
- Internet outage
- Cloud outage
- Printer failure

## Constraint 10 — Test Offline First

The system is not considered production-ready until offline transaction and synchronization tests pass.

---

# 46. Final Architecture Decision

The recommended Muneem architecture is:

```text
                     MUNEEM

                 ┌─────────────┐
                 │   Desktop   │
                 │   Electron  │
                 └──────┬──────┘
                        │
              ┌─────────▼─────────┐
              │ React + TypeScript│
              └─────────┬─────────┘
                        │
                   Secure IPC
                        │
              ┌─────────▼─────────┐
              │ Electron Main     │
              │ Process            │
              └─────┬──────┬──────┘
                    │      │
              ┌─────▼──┐ ┌─▼──────────┐
              │ SQLite │ │  Hardware  │
              └─────┬──┘ └────────────┘
                    │
               Sync Engine
                    │
                    ▼
              ┌─────────────┐
              │ Cloud API   │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ PostgreSQL  │
              └─────────────┘
```

### Final Stack

| Layer | Technology |
|---|---|
| Desktop | Electron |
| UI | React |
| Language | TypeScript |
| Desktop Runtime | Node.js |
| Native/privileged layer | Electron Main + Node.js |
| Local DB | SQLite |
| Cloud API | Go or NestJS |
| Cloud DB | PostgreSQL |
| Cache | Redis |
| Queue | Redis Streams / RabbitMQ / equivalent |
| File storage | S3-compatible object storage |
| Authentication | Token-based + secure device authentication |
| Hardware | Electron/Node native integrations |
| Mobile | React Native — future |
| Web | Next.js — future |

---

# 47. Final Product Definition

Muneem is not merely an invoice application.

It is:

```text
                    MUNEEM
                      │
       ┌──────────────┼──────────────┐
       │              │              │
      POS         INVENTORY      ACCOUNTING
       │              │              │
   Barcode        Purchases         GST
   Payments       Stock             Ledger
   Printer        Warehouses        Reports
   Cash Drawer    Transfers         Receivables
       │              │              │
       └──────────────┼──────────────┘
                      │
                 OFFLINE-FIRST
                      │
                 CLOUD SYNC
                      │
              MULTI-DEVICE / BRANCH
```

The fundamental product philosophy is:

> **Muneem should make a physical Indian business feel like it has a reliable digital operating system—without making the business dependent on the internet.**
