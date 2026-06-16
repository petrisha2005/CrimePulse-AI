import { Construction } from "lucide-react";

const ComingSoon = ({ title }: { title: string }) => (
  <div className="space-y-6">
    <div>
      <p className="text-sm uppercase tracking-[0.18em] text-command-300">CrimePulse AI</p>
      <h1 className="text-3xl font-semibold text-white">{title}</h1>
    </div>

    <section className="rounded-md border border-command-700 bg-command-900/85 p-8 shadow-glow">
      <div className="flex max-w-xl items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded border border-command-700 bg-command-850">
          <Construction className="h-6 w-6 text-command-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Coming Soon</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This module is reserved for the next CrimePulse AI build phase.
          </p>
        </div>
      </div>
    </section>
  </div>
);

export default ComingSoon;
