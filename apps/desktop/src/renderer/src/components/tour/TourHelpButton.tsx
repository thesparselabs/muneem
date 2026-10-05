import { HelpCircle } from 'lucide-react';
import { useTour } from './TourProvider.js';

export default function TourHelpButton() {
  const { running, start } = useTour();
  if (running) return null;
  return (
    <button
      type="button"
      onClick={start}
      aria-label="Take a tour"
      title="Take a tour"
      className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
    >
      <HelpCircle size={20} aria-hidden />
    </button>
  );
}
