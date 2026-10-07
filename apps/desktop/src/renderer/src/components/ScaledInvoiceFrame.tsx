import { useLayoutEffect, useRef, useState } from 'react';

// The invoice is laid out at its real page width and scaled down to the box, so a thumbnail shows the whole page, not a cropped corner.
export default function ScaledInvoiceFrame({ html, title, pageWidth }: { html: string; title: string; pageWidth: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / pageWidth);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageWidth]);
  return (
    <div ref={box} className="h-full w-full overflow-hidden bg-white">
      {scale > 0 && (
        <iframe title={title} srcDoc={html} tabIndex={-1} scrolling="no" className="pointer-events-none origin-top-left border-0"
          style={{ width: pageWidth, height: (box.current?.clientHeight ?? 0) / scale, transform: `scale(${scale})` }} />
      )}
    </div>
  );
}
