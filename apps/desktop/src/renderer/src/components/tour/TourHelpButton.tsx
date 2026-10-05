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
      className="fixed bottom-4 right-[22rem] z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
    >
      <HelpCircle size={20} aria-hidden />
    </button>
  );
}
