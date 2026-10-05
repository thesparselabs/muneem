export interface Box { top: number; left: number; width: number; height: number }

const GAP = 14;
const MARGIN = 16;

export function placeCard(target: Box | null, card: { width: number; height: number }, vw: number, vh: number): { top: number; left: number } {
  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - card.width - MARGIN));
  const clampY = (y: number) => Math.max(MARGIN, Math.min(y, vh - card.height - MARGIN));
  if (!target) return { top: clampY((vh - card.height) / 2), left: clampX((vw - card.width) / 2) };
  const midY = target.top + target.height / 2;
  const midX = target.left + target.width / 2;
  const right = target.left + target.width + GAP;
  if (right + card.width + MARGIN <= vw) return { top: clampY(midY - card.height / 2), left: right };
  const below = target.top + target.height + GAP;
  if (below + card.height + MARGIN <= vh) return { top: below, left: clampX(midX - card.width / 2) };
  const above = target.top - GAP - card.height;
  if (above >= MARGIN) return { top: above, left: clampX(midX - card.width / 2) };
  const left = target.left - GAP - card.width;
  if (left >= MARGIN) return { top: clampY(midY - card.height / 2), left };
  return { top: vh - card.height - MARGIN, left: clampX((vw - card.width) / 2) };
}
