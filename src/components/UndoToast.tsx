"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearUndo, useUndoOffer } from "@/lib/undo";

const SHOW_MS = 8000;

/** "Task completed · Undo" at the bottom of the page. ⌘Z works while it shows. */
export function UndoToast() {
  const router = useRouter();
  const offer = useUndoOffer();
  const [failed, setFailed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const running = useRef(false);

  // Hovering holds it open, so it can't vanish as you reach for it.
  useEffect(() => {
    if (!offer || paused) return;
    const t = setTimeout(clearUndo, SHOW_MS);
    return () => clearTimeout(t);
  }, [offer, paused]);

  const take = async () => {
    if (!offer || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await offer.undo();
      clearUndo();
      router.refresh();
    } catch {
      setFailed(offer.id);
    }
    running.current = false;
    setBusy(false);
  };

  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z" || el.matches("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      void take();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!offer) return null;
  const didFail = failed === offer.id;
  return (
    <div className="undo" role="status" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span>{didFail ? "Couldn't undo that." : offer.text}</span>
      {didFail ? null : (
        <button type="button" className="undo__btn" disabled={busy} onClick={take}>
          {busy ? "Undoing…" : "Undo"}
        </button>
      )}
    </div>
  );
}
