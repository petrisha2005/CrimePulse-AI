import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export type DecisionCenterTab = {
  id: string;
  label: string;
  route: string;
  content: ReactNode;
};

const DecisionCenterTabs = ({ title, purpose, tabs }: { title: string; purpose: string; tabs: DecisionCenterTab[] }) => {
  const { canAccessRoute } = useAuth();
  const availableTabs = useMemo(() => tabs.filter((tab) => canAccessRoute(tab.route)), [canAccessRoute, tabs]);
  const [activeId, setActiveId] = useState(availableTabs[0]?.id || "");

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeId)) setActiveId(availableTabs[0]?.id || "");
  }, [activeId, availableTabs]);

  const activeTab = availableTabs.find((tab) => tab.id === activeId) || availableTabs[0];
  return (
    <div className="space-y-6">
      <section className="card-safe border border-command-500/35 bg-command-500/5 p-5 shadow-glow"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Decision Center</p><h1 className="mt-1 text-3xl font-semibold text-white">{title}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{purpose}</p></section>
      <div className="flex overflow-x-auto border-b border-command-700" role="tablist" aria-label={`${title} tabs`}>
        {availableTabs.map((tab) => <button key={tab.id} aria-selected={activeTab?.id === tab.id} className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition ${activeTab?.id === tab.id ? "border-command-300 text-command-300" : "border-transparent text-slate-400 hover:text-white"}`} onClick={() => setActiveId(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      <section>
        {availableTabs.length ? availableTabs.map((tab) => (
          <div
            aria-hidden={activeTab?.id !== tab.id}
            className={activeTab?.id === tab.id ? "decision-center-tab" : "hidden"}
            key={tab.id}
            role="tabpanel"
          >
            {tab.content}
          </div>
        )) : <p className="border border-command-700 bg-command-900/85 p-5 text-sm text-slate-400">No modules are available for this role.</p>}
      </section>
    </div>
  );
};

export default DecisionCenterTabs;
