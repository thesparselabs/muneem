import { Link } from 'react-router-dom';
import { bannerText } from '../lib/update.js';
import { useUpdateStatus } from '../lib/useUpdateStatus.js';

export default function UpdateBanner() {
  const status = useUpdateStatus();
  const text = bannerText(status.data);
  if (!text) return null;
  return (
    <div role="status" className="-mx-6 -mt-6 mb-4 flex items-center justify-between bg-blue-50 px-6 py-1.5 text-sm text-blue-900 print:hidden">
      <span>{text}</span>
      <Link to="/settings/updates" className="underline">Details</Link>
    </div>
  );
}
