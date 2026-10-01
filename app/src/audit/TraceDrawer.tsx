/* Source audit drawer: number → player records → contract episodes → source file › sheet › row. */
import { useEffect } from 'react';
import { store, useModel, useStore } from '../state/store';
import { PLink, Table, Tag } from '../ui/components';
import { fmt$, sum } from '../ui/fmt';

export function TraceDrawer() {
  const t = useStore((s) => s.trace);
  const M = useModel();
  const close = () => store.set({ trace: null });
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const items = t ? t.items.filter((i) => i.amount !== 0 || t.items.length < 5) : [];
  const tot = sum(items.map((i) => i.amount));
  const rows = items.map((i) => { const e = i.eid ? M.epById.get(i.eid) : null; return { ...i, src: i.src || (e ? e.src : ''), conf: e ? e.conf : '', kind: e ? e.kind : '', raw: e ? e.srcRaw ?? '' : '' }; }).sort((a, b) => b.amount - a.amount);
  return (
    <div id="drawer" className={t ? 'open' : ''}>
      <div className="dh"><div><b>SOURCE AUDIT</b> <span className="t2">{t?.label}</span></div><button className="iconbtn" onClick={close}>✕ ESC</button></div>
      <div className="db">{t && <>
        <div className="note info">Number → player records → contract episodes → source file → source row. {rows.length} contributing records · total <b className="num">{fmt$(tot)}</b></div>
        <Table cols={[{ l: 'Player', k: 'pid', f: (r) => (r.pid && M.players.has(r.pid) ? <PLink pid={r.pid} /> : r.pid) }, { l: 'Amount', n: true, v: (r) => r.amount, f: (r) => fmt$(r.amount) },
          { l: 'Episode', k: 'eid' }, { l: 'Type', k: 'kind' }, { l: 'Source file › sheet › row', k: 'src', cls: 'wrap' }, { l: 'Source name', k: 'raw' }, { l: 'Status', f: (r) => (r.conf ? <Tag conf={r.conf} /> : '') }]}
          rows={rows} opts={{ maxh: 2000 }} />
      </>}</div>
    </div>
  );
}
