import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crimeService } from "../services/crimeService";
import NoDataState from "./NoDataState";
import StateBlock from "./StateBlock";

const getCount = (response: { totalRecords?: number; data?: { totalRecords?: number } }) => response.totalRecords ?? response.data?.totalRecords ?? 0;

const DataAvailabilityGate = ({ children, moduleName, dashboard = false }: { children: React.ReactNode; moduleName: string; dashboard?: boolean }) => {
  const { currentUser } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    try { setError(""); setCount(getCount(await crimeService.getCrimeCount())); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to confirm the stored CrimeRecords count."); }
  };

  useEffect(() => { void refresh(); window.addEventListener("crimepulse:dataset-updated", refresh); return () => window.removeEventListener("crimepulse:dataset-updated", refresh); }, []);
  if (error) return <StateBlock title="Dataset status unavailable" message={error} onRetry={() => void refresh()} />;
  if (count === null) return <StateBlock title="Checking dataset status" message="Confirming stored CrimeRecords before loading this module." />;
  if (count === 0) return <NoDataState currentUser={currentUser} moduleName={moduleName} dashboard={dashboard} />;
  return <>{children}</>;
};

export default DataAvailabilityGate;
