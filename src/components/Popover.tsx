"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Theme } from "@/lib/settings";

interface PopoverProps {
  /** Screen rect of the element the popover points at. */
  anchor: DOMRect;
  /** Portalled outside `.morning`, so it carries its own theme. */
  theme: Theme;
  onClose: () => void;
  /** Close when the page scrolls (good for read-only cards, not for editors). */
  closeOnScroll?: boolean;
  className?: string;
  ariaLabel: string;
  children: ReactNode;
}

/**
 * A portalled card anchored to an on-screen element: positions itself below the
 * anchor (or above when there's more room), clamps into the viewport, and
 * closes on outside-click / Esc / (optionally) scroll.
 */
export function Popover({
  anchor,
  theme,
  onClose,
  closeOnScroll = false,
  className,
  ariaLabel,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number }>(
    { top: -9999, left: -9999, maxHeight: 400 },
  );

  // Measure the rendered card, then place it. Canonical useLayoutEffect use.
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 120 || vh < 120) {
      // Hidden / detached pane reports 0×0 — don't compute against garbage.
      setPos({ top: 24, left: 12, maxHeight: 600 });
      return;
    }

    const clamp = (n: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(n, hi));

    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const gap = 8;
    const margin = 12;

    // The anchor may be partly or fully off-screen (scrolled list) — clamp it
    // into the viewport before measuring the room around it.
    const aTop = clamp(anchor.top, 0, vh);
    const aBottom = clamp(anchor.bottom, 0, vh);
    const roomBelow = vh - aBottom - gap - margin;
    const roomAbove = aTop - gap - margin;
    const below = roomBelow >= Math.min(height, 200) || roomBelow >= roomAbove;

    const maxHeight = clamp(below ? roomBelow : roomAbove, 160, vh - 2 * margin);
    const fit = Math.min(height, maxHeight);
    const top = clamp(
      below ? aBottom + gap : aTop - gap - fit,
      margin,
      Math.max(margin, vh - fit - margin),
    );

    const left = clamp(
      anchor.left + anchor.width / 2 - width / 2,
      margin,
      Math.max(margin, vw - width - margin),
    );

    setPos({ top, left, maxHeight });
  }, [anchor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScrollOrResize = () => onClose();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollOrResize);
    if (closeOnScroll) window.addEventListener("scroll", onScrollOrResize, true);
    // Defer so the click that opened this doesn't immediately close it.
    const t = window.setTimeout(
      () => document.addEventListener("pointerdown", onDown),
      0,
    );

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose, closeOnScroll]);

  return createPortal(
    <div
      ref={ref}
      className={className}
      data-theme={theme}
      role="dialog"
      aria-label={ariaLabel}
      style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}
