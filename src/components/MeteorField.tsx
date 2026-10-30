"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Occasional shooting stars: each one crosses the sky for a second or two, then waits out a
 * long, different cycle, so they come "here and there" without a rhythm. x/y are where the
 * head starts (% of the viewport), a the angle (under 90 falls right, over 90 falls left),
 * c the cycle in seconds, d a head start, l the length (px). Because the sections hide
 * them, some start out in a margin and fly in behind the cards, others start behind the
 * cards and come out into a margin, so each is seen on its way in or out.
 */
const METEORS = [
  { x: 2, y: 10, a: 28, c: 21, d: -4, l: 120 },
  { x: 21, y: 36, a: 156, c: 27, d: -13, l: 100 },
  { x: 98, y: 8, a: 152, c: 34, d: -22, l: 140 },
  { x: 79, y: 42, a: 27, c: 41, d: -31, l: 130 },
  { x: 3, y: 58, a: 31, c: 47, d: -9, l: 110 },
];

const SECTIONS = ".morning .card, .morning .attn";

/**
 * The shooting stars, fenced out of the page's sections: every card is cut out of this layer,
 * so a meteor fades from view as it passes behind one and is only seen in the margins and the
 * gaps. The cut-outs are re-measured on scroll, resize and whenever a card changes size.
 */
export function MeteorField({ fenced = true }: { fenced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    // Unfenced (the ambient screen): nothing sits over the sky, so nothing to cut out.
    if (!el || !fenced) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      timer = null;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rects = [...document.querySelectorAll(SECTIONS)]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)
        .sort((a, b) => b.width * b.height - a.width * a.height);
      // Even-odd fill: a rectangle inside another would punch back through, so skip nested ones.
      const holes: DOMRect[] = [];
      for (const r of rects) {
        const nested = holes.some((h) => r.left >= h.left - 0.5 && r.right <= h.right + 0.5 && r.top >= h.top - 0.5 && r.bottom <= h.bottom + 0.5);
        if (!nested) holes.push(r);
      }
      let d = `M0 0H${vw}V${vh}H0Z`;
      for (const r of holes) d += `M${r.left.toFixed(1)} ${r.top.toFixed(1)}h${r.width.toFixed(1)}v${r.height.toFixed(1)}h${(-r.width).toFixed(1)}Z`;
      el.style.clipPath = `path(evenodd, "${d}")`;
    };
    const schedule = () => {
      if (timer === null) timer = setTimeout(update, 16);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    document.querySelectorAll(SECTIONS).forEach((c) => ro.observe(c));
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, [fenced]);

  return (
    <div ref={ref} className="scene__meteors" aria-hidden>
      {METEORS.map((m, i) => (
        <span
          key={i}
          className="scene__meteor"
          style={{ "--x": `calc(${m.x}% - ${m.l}px)`, "--y": `${m.y}%`, "--a": `${m.a}deg`, "--c": m.c, "--d": `${m.d}s`, "--l": `${m.l}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}
