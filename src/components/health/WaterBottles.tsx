"use client";

import { useId, useState } from "react";

const SIZES = [{ ml: 355, label: 'Small · 12 fl oz' }, { ml: 500, label: 'Standard · 16.9 fl oz' }, { ml: 710, label: 'Medium · 24 fl oz' }, { ml: 946, label: 'Large · 32 fl oz' }, { ml: 1000, label: '1 litre' }];
const initialFills = (water: number, size: number) => Array.from({length: Math.ceil(20000 / size)}, (_, i) => Math.min(1, Math.max(0, water / size - i)));
export function WaterBottles({ water, onChange, bottleMl, onSizeChange, goal }: { water: number; onChange?: (water: number) => void; bottleMl: number; onSizeChange?: (ml: number) => void; goal?: number }) {
  const id = useId();
  const [state, setState] = useState(() => ({ water, bottleMl, fills: initialFills(water, bottleMl) }));
  // Retain independent bottle fills while tapping; reconcile external changes without altering volume.
  if (state.water !== water || state.bottleMl !== bottleMl) setState({ water, bottleMl, fills: initialFills(water, bottleMl) });
  const fills = state.water === water && state.bottleMl === bottleMl ? state.fills : initialFills(water, bottleMl);
  const bottles = Math.round(water / bottleMl * 10) / 10;
  const lastFilled = fills.findLastIndex(fill => fill > 0);
  const slots = Math.min(fills.length, Math.max(5, Math.ceil((goal ?? 0) / bottleMl), lastFilled + 2));
  function tap(i: number) {
    if (!onChange) return;
    const next = [...fills];
    next[i] = fills[i] < .5 ? .5 : fills[i] < 1 ? 1 : 0;
    const amount = Math.round((water + (next[i] - fills[i]) * bottleMl) * 100) / 100;
    if (amount > 20000) return;
    setState({water: amount, bottleMl, fills: next});
    onChange(amount);
  }
  return <div className="health-bottles">
    {onSizeChange ? <label>My bottle size<select value={bottleMl} onChange={e => onSizeChange(Number(e.target.value))}>{SIZES.map(size => <option key={size.ml} value={size.ml}>{size.label} · {size.ml} mL</option>)}</select></label> : null}
    <div className="health-bottles__icons" role={onChange ? 'group' : 'img'} aria-label={onChange ? 'Tap a bottle: empty, half full, full, then empty' : `${bottles} bottles; each bottle ${bottleMl} millilitres`}>
      {Array.from({ length: slots }, (_, i) => {
        const fill = fills[i];
        const icon = <svg viewBox="0 0 24 44" aria-hidden="true"><defs><clipPath id={`bottle-${id}-${i}`}><path d="M8 9h8v5l4 5v20H4V19l4-5Z"/></clipPath></defs><rect x="3" y={39 - fill * 30} width="18" height="31" clipPath={`url(#bottle-${id}-${i})`} className="health-bottle-fill"/><path d="M8 9h8v5l4 5v20H4V19l4-5ZM8 4h8v5H8Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>;
        const level = fill === 0 ? 'empty' : fill === .5 ? 'half full' : fill === 1 ? 'full' : 'partially full';
        const next = fill < .5 ? 'half full' : fill < 1 ? 'full' : 'empty';
        return onChange ? <button key={i} type="button" className="health-bottle-tap" aria-label={`Bottle ${i+1}: ${level}. Set to ${next}`} title={`Bottle ${i+1}: ${level} → ${next}`} onClick={() => tap(i)}>{icon}<span>{fill === .5 ? '½' : fill === 1 ? '1' : '·'}</span></button> : <span key={i}>{icon}</span>;
      })}
    </div>
    <div className="health-bottles__controls" aria-live="polite"><strong>{bottles} bottles{goal ? <small> / {Math.round(goal / bottleMl * 10) / 10} target</small> : null}</strong></div>
    {onChange ? <p className="health-caption">Tap a bottle: empty → half → full → empty.</p> : null}
    <p className="health-caption">{(water / 1000).toLocaleString()} L · {bottleMl} mL per bottle{onSizeChange ? ' · Changing size keeps your logged volume.' : ''}</p>
  </div>;
}
