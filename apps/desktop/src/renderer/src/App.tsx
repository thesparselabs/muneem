import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { useUi } from './store.js';
import Login from './routes/Login.js';
import SwitchUser from './routes/SwitchUser.js';
import Setup from './routes/Setup.js';
import Parties from './routes/parties/Parties.js';
import PartyPage from './routes/parties/PartyPage.js';
import Outstanding from './routes/parties/Outstanding.js';
import Payments from './routes/payments/Payments.js';
import NewPayment from './routes/payments/NewPayment.js';
import PaymentPage from './routes/payments/PaymentPage.js';
import Purchases from './routes/purchases/Purchases.js';
import NewPurchase from './routes/purchases/NewPurchase.js';
import PurchasePage from './routes/purchases/PurchasePage.js';
import Expenses from './routes/expenses/Expenses.js';
import ChartOfAccounts from './routes/accounts/ChartOfAccounts.js';
import AccountLedger from './routes/accounts/AccountLedger.js';
import Statements from './routes/accounts/Statements.js';
import Books from './routes/accounts/Books.js';
import ManualJournal from './routes/accounts/ManualJournal.js';
import Periods from './routes/accounts/Periods.js';
import Shell from './routes/Shell.js';
import Home from './routes/Home.js';
import Diagnostics from './routes/Diagnostics.js';
import Products from './routes/Products.js';
import ProductEdit from './routes/ProductEdit.js';
import ImportProducts from './routes/ImportProducts.js';
import CatalogSettings from './routes/CatalogSettings.js';
import PosScreen from './routes/pos/PosScreen.js';
import StockList from './routes/inventory/StockList.js';
import ProductLedger from './routes/inventory/ProductLedger.js';
import AdjustStock from './routes/inventory/AdjustStock.js';
import StockTake from './routes/inventory/StockTake.js';
import OpeningStock from './routes/inventory/OpeningStock.js';
import PrinterSettings from './routes/PrinterSettings.js';
import StockReconciliation from './routes/inventory/StockReconciliation.js';
import ReviewItems from './routes/settings/ReviewItems.js';

export default function App() {
  const { session, setSession, setSync, setOnline } = useUi();
  const loc = useLocation();
  useEffect(() => {
    void api.auth.getSession({}).then(setSession);
    void api.app.getConnectivity({}).then((c) => setOnline(c.online));
    void api.sync.getStatus({}).then(setSync);
    const offs = [
      api.events.on('session.changed', setSession),
      api.events.on('sync.status', setSync),
      api.events.on('connectivity.changed', (c) => setOnline(c.online)),
    ];
    return () => offs.forEach((f) => f());
  }, [setSession, setSync, setOnline]);

  if (session === undefined) return <div className="p-10 text-slate-500">Starting Muneem…</div>;
  if (!session && loc.pathname !== '/login' && loc.pathname !== '/switch') return <Navigate to="/login" replace />;
  if (session && !session.businessId && loc.pathname !== '/setup') return <Navigate to="/setup" replace />;
  if (session && session.businessId && !session.terminalId && loc.pathname !== '/setup') return <Navigate to="/setup" replace />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/switch" element={<SwitchUser />} />
      <Route path="/setup" element={<Setup />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/new" element={<ProductEdit key="new" />} />
        <Route path="/products/import" element={<ImportProducts />} />
        <Route path="/products/:id" element={<ProductEdit />} />
        <Route path="/settings/catalog" element={<CatalogSettings />} />
        <Route path="/pos" element={<PosScreen />} />
        <Route path="/inventory" element={<StockList />} />
        <Route path="/inventory/product/:id" element={<ProductLedger />} />
        <Route path="/inventory/adjust" element={<AdjustStock />} />
        <Route path="/inventory/stock-take" element={<StockTake />} />
        <Route path="/inventory/opening" element={<OpeningStock />} />
        <Route path="/inventory/reconciliation" element={<StockReconciliation />} />
        <Route path="/parties" element={<Parties />} />
        <Route path="/parties/outstanding" element={<Outstanding />} />
        <Route path="/parties/:kind/:id" element={<PartyPage />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchases/new" element={<NewPurchase />} />
        <Route path="/purchases/:id" element={<PurchasePage />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payments/new" element={<NewPayment />} />
        <Route path="/payments/:id" element={<PaymentPage />} />
        <Route path="/accounts" element={<ChartOfAccounts />} />
        <Route path="/accounts/ledger/:id" element={<AccountLedger />} />
        <Route path="/accounts/statements" element={<Statements />} />
        <Route path="/accounts/books" element={<Books />} />
        <Route path="/accounts/journal/new" element={<ManualJournal />} />
        <Route path="/accounts/periods" element={<Periods />} />
        <Route path="/settings/printer" element={<PrinterSettings />} />
        <Route path="/settings/review" element={<ReviewItems />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
