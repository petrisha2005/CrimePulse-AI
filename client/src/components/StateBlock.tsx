import { useEffect, useState } from "react";

interface StateBlockProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

const StateBlock = ({ title, message, onRetry }: StateBlockProps) => {
  const isLoadingState = title.toLowerCase().startsWith("loading") || title.toLowerCase().startsWith("checking");
  const [visible, setVisible] = useState(!isLoadingState);

  useEffect(() => {
    if (!isLoadingState) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), 260);
    return () => window.clearTimeout(timer);
  }, [isLoadingState, title]);

  if (!visible) return <div className="min-h-24" aria-hidden="true" />;

  return (
    <div className="rounded-md border border-command-700 bg-command-900/80 p-6 text-center">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      {onRetry && <button className="mt-4 min-h-10 border border-command-700 px-4 text-sm font-semibold text-command-300 hover:bg-command-850" onClick={onRetry} type="button">Retry</button>}
    </div>
  );
};

export default StateBlock;
