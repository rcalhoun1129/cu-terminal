/* Application shell: dataset loading, layout, router and the source-audit drawer. */
import { useEffect } from 'react';
import { TraceDrawer } from './audit/TraceDrawer';
import { loadDataset } from './data/load';
import { logAudit, store, useStore } from './state/store';
import { NAV } from './shell/nav';
import { parseRoute, ROUTES } from './shell/routes';
import { useHash } from './shell/router';
import { CmdBar, DatasetBadge, Rail, ScreenBoundary, SideNav, TopBar, useGlobalDelegation } from './shell/Shell';

let loadStarted = false; // StrictMode runs mount effects twice in development; load (and log) once.
function crumbFor(h: string, name: string) {
  const c = NAV.flatMap((n) => n[2].map((s) => [n[1], s[0], s[1]])).find((x) => x[2] === h || x[2] === name);
  return c ? `${c[0].toUpperCase()} › ${c[1]}` : h.toUpperCase().replace(/\//g, ' › ');
}

export default function App() {
  const data = useStore((s) => s.data); const err = useStore((s) => s.loadError); const rail = useStore((s) => s.rail);
  const h = useHash(); const { name, args } = parseRoute(h); const Screen = ROUTES[name];
  useGlobalDelegation();
  useEffect(() => {
    if (loadStarted) return; loadStarted = true;
    loadDataset().then((d) => { store.set({ data: d.data, source: d.source, sourceLabel: d.label }); logAudit('Session opened · dataset built ' + d.data.meta.built); })
      .catch((e: Error) => store.set({ loadError: e.message }));
  }, []);
  useEffect(() => { document.getElementById('main')?.scrollTo(0, 0); }, [h]);
  if (err) return <div className="loading">Could not load the dataset: {err}</div>;
  if (!data) return <div className="loading">Loading dataset…</div>;
  const navCur = h.startsWith('tape') ? h.split('/').slice(0, 2).join('/') : h;
  return <>
    <div id="app">
      <div id="top"><div className="logo"><b>CU</b>BUY-SIDE CAPITAL MANAGER</div><TopBar /><DatasetBadge /><div id="asof">AS OF {data.meta.asOf}</div></div>
      <div id="cmdrow"><button className="iconbtn" id="btnSide" title="Collapse navigation" onClick={() => store.set((s) => ({ sidebarMin: !s.sidebarMin }))}>☰</button><CmdBar />
        <div id="crumbs">{crumbFor(h, name)}</div><span style={{ flex: 1 }}></span><span className="muted mono" style={{ fontSize: '10.5px' }}>Structure is the Standard.™</span>
        <button className={`iconbtn ${rail ? 'on' : ''}`} id="btnRail" onClick={() => store.set((s) => ({ rail: !s.rail }))}>Intelligence rail</button></div>
      <div id="body"><SideNav cur={navCur} /><main id="main"><ScreenBoundary key={h}><Screen args={args} /></ScreenBoundary></main><Rail /></div>
    </div>
    <div id="tip"></div><TraceDrawer />
  </>;
}
