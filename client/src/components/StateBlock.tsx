interface StateBlockProps {
  title: string;
  message: string;
}

const StateBlock = ({ title, message }: StateBlockProps) => (
  <div className="rounded-md border border-command-700 bg-command-900/80 p-6 text-center">
    <p className="font-medium text-white">{title}</p>
    <p className="mt-2 text-sm text-slate-400">{message}</p>
  </div>
);

export default StateBlock;
