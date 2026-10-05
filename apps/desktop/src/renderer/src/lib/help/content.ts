export type HelpLang = 'en' | 'hi';

export interface HelpShortcut { keys: string; does: string }
export interface HelpEntry {
  title: string;
  whatFor: string;
  howItWorks: string[];
  shortcuts?: HelpShortcut[];
}
export interface HelpTopic { en: HelpEntry; hi: HelpEntry }

export const HELP: Record<string, HelpTopic> = {
  '/': {
    en: {
      title: 'Home',
      whatFor: 'Your daily starting point: today at a glance, quick links to billing, stock and reports.',
      howItWorks: [
        'Check today’s sales, dues and low-stock alerts on the cards.',
        'Use the quick links to start a bill or open a screen.',
        'Use the left menu any time to switch screens.',
        'The top bar shows online/offline and sync status. Offline is fine; data syncs later.',
      ],
    },
    hi: {
      title: 'होम',
      whatFor: 'रोज़ का शुरुआती पन्ना: आज की स्थिति एक नज़र में, बिलिंग, स्टॉक और रिपोर्ट के शॉर्टकट।',
      howItWorks: [
        'कार्ड पर आज की बिक्री, बकाया और कम स्टॉक की सूचना देखें।',
        'बिल बनाने या कोई स्क्रीन खोलने के लिए शॉर्टकट इस्तेमाल करें।',
        'किसी भी समय बाएँ मेन्यू से स्क्रीन बदलें।',
        'ऊपर की पट्टी में ऑनलाइन/ऑफ़लाइन और सिंक की स्थिति दिखती है। ऑफ़लाइन चलेगा, डेटा बाद में सिंक हो जाएगा।',
      ],
    },
  },
  '/pos': {
    en: {
      title: 'POS · Billing',
      whatFor: 'The billing counter. Make bills fast: scan or search items, apply discounts, take payment, print.',
      howItWorks: [
        'Open the register (with opening cash) if asked.',
        'Search an item by name or barcode and press Enter to add it.',
        'Change quantity in the cart; use "Add" under Discount for a line discount.',
        'Pick a customer (F3) for credit sales or a GST invoice with their GSTIN.',
        'Press F5 to take payment: cash, UPI, card or credit. The bill is saved and printed.',
        'Not ready? Hold the bill (F6) and bring it back later (F7).',
        'At day end, close the register to see the Z report.',
      ],
      shortcuts: [
        { keys: 'F2', does: 'Focus item search' },
        { keys: 'F3', does: 'Choose customer' },
        { keys: 'F4', does: 'Bill discount' },
        { keys: 'F5', does: 'Take payment' },
        { keys: 'F6', does: 'Hold current bill' },
        { keys: 'F7', does: 'Held bills' },
        { keys: 'F9', does: 'Reprint last bill' },
        { keys: 'Esc', does: 'Clear the cart' },
        { keys: 'Enter', does: 'Add the top search result' },
      ],
    },
    hi: {
      title: 'POS · बिलिंग',
      whatFor: 'बिलिंग काउंटर। आइटम स्कैन या खोजें, छूट लगाएँ, भुगतान लें और प्रिंट करें।',
      howItWorks: [
        'पूछे जाने पर रजिस्टर खोलें (शुरुआती नकद के साथ)।',
        'आइटम का नाम या बारकोड खोजें और जोड़ने के लिए Enter दबाएँ।',
        'कार्ट में मात्रा बदलें; लाइन छूट के लिए "Add" दबाएँ।',
        'उधार बिक्री या GSTIN वाले GST बिल के लिए ग्राहक चुनें (F3)।',
        'भुगतान के लिए F5: नकद, UPI, कार्ड या उधार। बिल सेव और प्रिंट हो जाता है।',
        'तैयार नहीं? बिल रोकें (F6) और बाद में वापस लाएँ (F7)।',
        'दिन के अंत में रजिस्टर बंद करें और Z रिपोर्ट देखें।',
      ],
      shortcuts: [
        { keys: 'F2', does: 'आइटम खोज पर जाएँ' },
        { keys: 'F3', does: 'ग्राहक चुनें' },
        { keys: 'F4', does: 'बिल पर छूट' },
        { keys: 'F5', does: 'भुगतान लें' },
        { keys: 'F6', does: 'मौजूदा बिल रोकें' },
        { keys: 'F7', does: 'रोके हुए बिल' },
        { keys: 'F9', does: 'आख़िरी बिल दोबारा प्रिंट करें' },
        { keys: 'Esc', does: 'कार्ट खाली करें' },
        { keys: 'Enter', does: 'खोज का पहला नतीजा जोड़ें' },
      ],
    },
  },
  '/products': {
    en: {
      title: 'Products',
      whatFor: 'Your item catalogue: names, prices, GST rates, units and barcodes. Billing depends on it.',
      howItWorks: [
        'Click Add product and fill name, selling price, GST rate and unit.',
        'Or use Import to bring a whole list from a spreadsheet.',
        'Click a product to edit price, units or barcode.',
        'Units, categories and price lists are managed under "Units, categories & price lists".',
        'Start with your 10 best-selling items; add the rest later.',
      ],
    },
    hi: {
      title: 'प्रोडक्ट',
      whatFor: 'आपके सामान की सूची: नाम, दाम, GST दर, इकाई और बारकोड। बिलिंग इसी पर चलती है।',
      howItWorks: [
        'Add product दबाएँ और नाम, बिक्री मूल्य, GST दर और इकाई भरें।',
        'या Import से स्प्रेडशीट की पूरी सूची ले आएँ।',
        'किसी प्रोडक्ट पर क्लिक करके दाम, इकाई या बारकोड बदलें।',
        'इकाई, श्रेणी और प्राइस लिस्ट "Units, categories & price lists" में संभालें।',
        'पहले अपने 10 सबसे ज़्यादा बिकने वाले आइटम डालें, बाक़ी बाद में।',
      ],
    },
  },
  '/inventory': {
    en: {
      title: 'Inventory',
      whatFor: 'Know what stock you have, where it moved, and fix differences with the shelf.',
      howItWorks: [
        'The stock list shows quantity on hand per product.',
        'Open a product to see its stock ledger (every in/out).',
        'Adjust stock for damage, loss or corrections, with a reason.',
        'Stock take: count the shelf and post the differences.',
        'Opening stock sets quantities when you first start using Muneem.',
        'Reconciliation compares recorded stock with the ledger.',
      ],
    },
    hi: {
      title: 'इन्वेंटरी',
      whatFor: 'जानें कितना स्टॉक है, कहाँ से कहाँ गया, और शेल्फ़ से फ़र्क़ ठीक करें।',
      howItWorks: [
        'स्टॉक सूची में हर प्रोडक्ट की मौजूदा मात्रा दिखती है।',
        'किसी प्रोडक्ट को खोलकर उसकी स्टॉक बही (हर आवक/जावक) देखें।',
        'टूट-फूट, नुकसान या सुधार के लिए कारण के साथ स्टॉक एडजस्ट करें।',
        'स्टॉक टेक: शेल्फ़ गिनें और फ़र्क़ पोस्ट करें।',
        'ओपनिंग स्टॉक से Muneem शुरू करते समय मात्रा सेट होती है।',
        'रिकंसिलिएशन में दर्ज स्टॉक की बही से तुलना होती है।',
      ],
    },
  },
  '/sales': {
    en: {
      title: 'Sales & Returns',
      whatFor: 'Every bill you made. Find, reprint, or return items.',
      howItWorks: [
        'Search or filter bills by date, number or customer.',
        'Open a bill to view it or reprint it.',
        'Use Return to take back items; stock and the customer’s account update automatically.',
        'Bills are never deleted; corrections are made with returns.',
      ],
    },
    hi: {
      title: 'बिक्री और वापसी',
      whatFor: 'आपके बनाए सारे बिल। खोजें, दोबारा प्रिंट करें या सामान वापस लें।',
      howItWorks: [
        'तारीख, नंबर या ग्राहक से बिल खोजें या छाँटें।',
        'बिल खोलकर देखें या दोबारा प्रिंट करें।',
        'सामान वापस लेने के लिए Return दबाएँ; स्टॉक और ग्राहक का खाता अपने आप बदल जाता है।',
        'बिल कभी मिटते नहीं; सुधार वापसी से होता है।',
      ],
    },
  },
  '/parties': {
    en: {
      title: 'Parties',
      whatFor: 'Customers and suppliers, with their balances (who owes you, whom you owe).',
      howItWorks: [
        'Add a customer or supplier with phone and GSTIN (if any).',
        'Open a party to see its statement and bills.',
        'Outstanding lists everyone with a pending balance.',
        'Receive or make a payment from the party page.',
      ],
    },
    hi: {
      title: 'पार्टियाँ',
      whatFor: 'ग्राहक और सप्लायर, और उनका बकाया (किसे आपको देना है, आपको किसे देना है)।',
      howItWorks: [
        'फ़ोन और GSTIN (हो तो) के साथ ग्राहक या सप्लायर जोड़ें।',
        'पार्टी खोलकर उसका स्टेटमेंट और बिल देखें।',
        'Outstanding में हर बकाया वाली पार्टी की सूची है।',
        'पार्टी के पन्ने से भुगतान लें या दें।',
      ],
    },
  },
  '/purchases': {
    en: {
      title: 'Purchases',
      whatFor: 'Record goods bought from suppliers. Stock goes up and input GST is tracked.',
      howItWorks: [
        'Click New purchase and pick the supplier.',
        'Add items with quantity, cost and GST.',
        'Save; stock increases and the supplier’s balance updates.',
        'Open a purchase to view or cancel it.',
      ],
    },
    hi: {
      title: 'ख़रीद',
      whatFor: 'सप्लायर से ख़रीदा माल दर्ज करें। स्टॉक बढ़ता है और इनपुट GST दर्ज होता है।',
      howItWorks: [
        'New purchase दबाएँ और सप्लायर चुनें।',
        'मात्रा, लागत और GST के साथ आइटम जोड़ें।',
        'सेव करें; स्टॉक बढ़ेगा और सप्लायर का बकाया बदलेगा।',
        'ख़रीद खोलकर देखें या रद्द करें।',
      ],
    },
  },
  '/payments': {
    en: {
      title: 'Payments',
      whatFor: 'Money received from customers and paid to suppliers, matched against their bills.',
      howItWorks: [
        'Click new payment, choose Receive (customer) or Pay (supplier).',
        'Pick the party and enter the amount and mode.',
        'Allocate the amount against pending bills.',
        'Save; balances update and a receipt is numbered.',
      ],
    },
    hi: {
      title: 'भुगतान',
      whatFor: 'ग्राहकों से मिला और सप्लायर को दिया पैसा, बिलों से मिलान के साथ।',
      howItWorks: [
        'नया भुगतान दबाएँ, Receive (ग्राहक) या Pay (सप्लायर) चुनें।',
        'पार्टी चुनें और राशि व तरीका भरें।',
        'राशि को बकाया बिलों पर बाँटें।',
        'सेव करें; बकाया बदल जाएगा और रसीद नंबर बनेगा।',
      ],
    },
  },
  '/expenses': {
    en: {
      title: 'Expenses',
      whatFor: 'Shop running costs such as rent, electricity, salary and transport.',
      howItWorks: [
        'Add an expense with category, amount, date and mode.',
        'It posts to your accounts automatically.',
        'Review the list to see where money went; reports use it for profit.',
      ],
    },
    hi: {
      title: 'ख़र्चे',
      whatFor: 'दुकान चलाने का ख़र्च: किराया, बिजली, वेतन, भाड़ा आदि।',
      howItWorks: [
        'श्रेणी, राशि, तारीख और तरीके के साथ ख़र्चा जोड़ें।',
        'यह अपने आप आपके खातों में चढ़ जाता है।',
        'सूची से देखें पैसा कहाँ गया; मुनाफ़े की रिपोर्ट इसी से बनती है।',
      ],
    },
  },
  '/accounts': {
    en: {
      title: 'Accounts',
      whatFor: 'Your books: chart of accounts, ledgers, statements, journals and year-end.',
      howItWorks: [
        'Chart of accounts lists every account; open one for its ledger.',
        'Statements show the Profit & Loss and Balance Sheet.',
        'Books shows day book and cash/bank books.',
        'Manual journal is for adjustments only; use with care.',
        'Periods lock finished months; Year end closes the financial year.',
      ],
    },
    hi: {
      title: 'खाते',
      whatFor: 'आपकी बही: खातों की सूची, खाता-बही, स्टेटमेंट, जर्नल और वर्ष-समापन।',
      howItWorks: [
        'Chart of accounts में सारे खाते हैं; किसी को खोलकर उसकी बही देखें।',
        'Statements में लाभ-हानि और बैलेंस शीट मिलती है।',
        'Books में रोज़नामचा और नकद/बैंक बही है।',
        'Manual journal सिर्फ़ सुधार के लिए है; सावधानी से इस्तेमाल करें।',
        'Periods पूरे हो चुके महीने लॉक करता है; Year end वित्त वर्ष बंद करता है।',
      ],
    },
  },
  '/gst': {
    en: {
      title: 'GST',
      whatFor: 'Prepare your GST returns, set off input tax against output tax, and record tax paid.',
      howItWorks: [
        'GST returns: pick the month and review sales and purchase tax.',
        'Set-off shows how input credit reduces what you owe.',
        'GST payments records challans you have paid.',
        'Check the figures against your filing before submitting on the GST portal.',
      ],
    },
    hi: {
      title: 'GST',
      whatFor: 'GST रिटर्न तैयार करें, इनपुट टैक्स को आउटपुट टैक्स से घटाएँ और चुकाया टैक्स दर्ज करें।',
      howItWorks: [
        'GST returns: महीना चुनें और बिक्री व ख़रीद का टैक्स जाँचें।',
        'Set-off दिखाता है कि इनपुट क्रेडिट से कितना देना कम हुआ।',
        'GST payments में आपके भरे चालान दर्ज होते हैं।',
        'GST पोर्टल पर फ़ाइल करने से पहले आँकड़े मिला लें।',
      ],
    },
  },
  '/reports': {
    en: {
      title: 'Reports',
      whatFor: 'Sales, profit, stock value and GST summaries to see how the business is doing.',
      howItWorks: [
        'Choose a report from the list.',
        'Set the date range and any filters.',
        'Run it; results appear as a table.',
        'Export or print for your accountant.',
      ],
    },
    hi: {
      title: 'रिपोर्ट',
      whatFor: 'बिक्री, मुनाफ़ा, स्टॉक मूल्य और GST की समरी, ताकि कारोबार का हाल पता रहे।',
      howItWorks: [
        'सूची से रिपोर्ट चुनें।',
        'तारीख़ की सीमा और फ़िल्टर तय करें।',
        'चलाएँ; नतीजा तालिका में दिखेगा।',
        'अपने अकाउंटेंट के लिए एक्सपोर्ट या प्रिंट करें।',
      ],
    },
  },
  '/settings/invoice': {
    en: {
      title: 'Invoice design',
      whatFor: 'Make your invoice look like your shop: template, logo, shop details and paper size.',
      howItWorks: [
        'Pick a template from the gallery.',
        'Add your logo and shop details (name, address, GSTIN).',
        'Choose the paper size (A4, A5 or thermal).',
        'Watch the live Preview on the right; changes show instantly.',
        'Save to use it for all new bills.',
      ],
    },
    hi: {
      title: 'इनवॉइस डिज़ाइन',
      whatFor: 'इनवॉइस को अपनी दुकान जैसा बनाएँ: टेम्पलेट, लोगो, दुकान का विवरण और काग़ज़ का आकार।',
      howItWorks: [
        'गैलरी से टेम्पलेट चुनें।',
        'अपना लोगो और दुकान का विवरण (नाम, पता, GSTIN) जोड़ें।',
        'काग़ज़ का आकार चुनें (A4, A5 या थर्मल)।',
        'दाईं ओर लाइव Preview देखें; बदलाव तुरंत दिखते हैं।',
        'सेव करें, सारे नए बिलों में यही इस्तेमाल होगा।',
      ],
    },
  },
  '/settings/printer': {
    en: {
      title: 'Receipt printer',
      whatFor: 'Connect and configure the printer used for receipts.',
      howItWorks: [
        'Choose the printer and paper width.',
        'Print a test page to check.',
        'Save; POS will use it for new bills.',
      ],
    },
    hi: {
      title: 'रसीद प्रिंटर',
      whatFor: 'रसीद छापने वाला प्रिंटर जोड़ें और सेट करें।',
      howItWorks: [
        'प्रिंटर और काग़ज़ की चौड़ाई चुनें।',
        'जाँच के लिए टेस्ट पेज छापें।',
        'सेव करें; POS नए बिलों के लिए इसे इस्तेमाल करेगा।',
      ],
    },
  },
  '/settings': {
    en: {
      title: 'Settings',
      whatFor: 'Shop-level setup: catalogue units, review items, printer and software updates.',
      howItWorks: [
        'Review items lists records that need your attention after syncing.',
        'Updates checks for and installs new versions.',
        'Printer and invoice design have their own screens in the menu.',
      ],
    },
    hi: {
      title: 'सेटिंग्स',
      whatFor: 'दुकान की सेटिंग: इकाइयाँ, समीक्षा के आइटम, प्रिंटर और सॉफ़्टवेयर अपडेट।',
      howItWorks: [
        'Review items में सिंक के बाद आपके ध्यान लायक रिकॉर्ड दिखते हैं।',
        'Updates नया संस्करण खोजकर इंस्टॉल करता है।',
        'प्रिंटर और इनवॉइस डिज़ाइन की अपनी स्क्रीन मेन्यू में हैं।',
      ],
    },
  },
  '/diagnostics': {
    en: {
      title: 'Diagnostics',
      whatFor: 'Health of the app: sync, backups, audit trail and crash reporting.',
      howItWorks: [
        'Sync shows whether data is up to date with the cloud.',
        'Backups lets you create and restore a copy of your data.',
        'Audit lists who did what and when.',
        'Crash reporting can be switched on or off here.',
      ],
    },
    hi: {
      title: 'डायग्नोस्टिक्स',
      whatFor: 'ऐप की सेहत: सिंक, बैकअप, ऑडिट ट्रेल और क्रैश रिपोर्टिंग।',
      howItWorks: [
        'Sync बताता है कि डेटा क्लाउड के साथ अपडेट है या नहीं।',
        'Backups से अपने डेटा की कॉपी बना और वापस ला सकते हैं।',
        'Audit में दर्ज है कि किसने कब क्या किया।',
        'क्रैश रिपोर्टिंग यहाँ चालू या बंद की जा सकती है।',
      ],
    },
  },
};

const FALLBACK: HelpTopic = {
  en: {
    title: 'Help',
    whatFor: 'Muneem is your billing and khata counter. It works offline and syncs when online.',
    howItWorks: ['Use the left menu to switch screens.', 'Open the ? menu for a guided tour any time.'],
  },
  hi: {
    title: 'सहायता',
    whatFor: 'Muneem आपका बिलिंग और खाता काउंटर है। ऑफ़लाइन चलता है और ऑनलाइन होने पर सिंक करता है।',
    howItWorks: ['स्क्रीन बदलने के लिए बाएँ मेन्यू का इस्तेमाल करें।', 'गाइडेड टूर के लिए कभी भी ? मेन्यू खोलें।'],
  },
};

export function helpFor(pathname: string, lang: HelpLang): HelpEntry {
  const key = Object.keys(HELP)
    .filter((k) => k === '/' ? pathname === '/' : pathname === k || pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (key ? HELP[key]! : FALLBACK)[lang];
}
