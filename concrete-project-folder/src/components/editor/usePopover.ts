import { useEffect, useRef, useState } from 'react';

const POPOVER_WIDTH = 276;

/** ตำแหน่ง/เปิด/ปิด popover ภายในกล่องรูป — ปิดเมื่อกด Esc หรือคลิกนอกกล่อง */
export function usePopover<T>() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ pick: T; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSel(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [sel]);

  const openAt = (pick: T, clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setSel({ pick, x: clientX - rect.left, y: clientY - rect.top });
  };
  const openTopRight = (pick: T) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) openAt(pick, rect.right - POPOVER_WIDTH / 2, rect.top + 24);
  };

  const wrapWidth = wrapRef.current?.clientWidth ?? 600;
  const style = sel
    ? { left: Math.max(8, Math.min(sel.x + 12, wrapWidth - POPOVER_WIDTH - 8)), top: Math.max(8, sel.y + 12) }
    : undefined;

  return { wrapRef, sel, close: () => setSel(null), openAt, openTopRight, style };
}
