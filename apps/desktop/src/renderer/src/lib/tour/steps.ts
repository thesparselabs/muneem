export interface TourStep {
  id: string;
  title: string;
  body: string;
  route?: string;
  selector?: string;
}

const nav = (path: string) => `nav[aria-label="Main"] a[href$="${path}"]`;

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome', route: '/', title: 'Namaste! Welcome to Muneem',
    body: 'Think of Muneem as the khata and billing counter on your own computer. It works even without internet, and syncs quietly whenever you are online. Let us take a 1-minute walk through your first day.',
  },
  {
    id: 'menu', route: '/', selector: 'nav[aria-label="Main"]', title: 'Your menu, always on the left',
    body: 'Everything lives here: billing, stock, parties, GST and reports. Click any name to switch screens. Your data stays on this computer, so nothing waits on the internet.',
  },
  {
    id: 'status', route: '/', selector: 'header', title: 'Know your status at a glance',
    body: 'The top bar shows if you are online, whether your data is synced, and who is logged in. Offline is fine. Keep billing, Muneem will sync later.',
  },
  {
    id: 'pos', route: '/pos', selector: nav('/pos'), title: 'Billing starts at POS',
    body: 'This is your counter. Search or scan an item, set the quantity, pick a customer if needed, and take payment. The bill, GST and stock update by themselves.',
  },
  {
    id: 'pos-screen', route: '/pos', selector: 'main', title: 'A bill in three steps',
    body: 'First add items, then check the total and tax, then take payment and print or save the invoice. Made a mistake? Fix it before payment, or make a return later.',
  },
  {
    id: 'products', route: '/products', selector: nav('/products'), title: 'Add your items once',
    body: 'Keep your products here with price, GST rate and unit. After that, billing is just a search away. You can also import a whole list from a spreadsheet.',
  },
  {
    id: 'products-list', route: '/products', selector: 'main', title: 'Your catalogue',
    body: 'Use the Add or Import buttons on this screen to fill your catalogue. Start with your 10 best-selling items; the rest can come later.',
  },
  {
    id: 'sales', route: '/sales', selector: nav('/sales'), title: 'Every bill you made',
    body: 'Find an old bill, reprint it, or process a customer return from here. Nothing is ever lost.',
  },
  {
    id: 'reports', route: '/reports', selector: nav('/reports'), title: 'See how the business is doing',
    body: 'Sales, profit, stock value and GST summaries. Check this at the end of the day, and you will always know where you stand.',
  },
  {
    id: 'invoice', route: '/settings/invoice', selector: nav('/settings/invoice'), title: 'Make the invoice yours',
    body: 'Pick a template, add your logo and shop details, and choose the paper size. Customers see this, so make it look like your shop.',
  },
  {
    id: 'invoice-preview', route: '/settings/invoice', selector: '[aria-label="Preview"]', title: 'Live preview',
    body: 'Every change shows up here instantly, so you see exactly what will print.',
  },
  {
    id: 'done', route: '/', title: 'You are all set!',
    body: 'Add a few products and make your first bill. Need this walkthrough again? Tap the ? button at the bottom-right anytime. Shubh vyapaar!',
  },
];
