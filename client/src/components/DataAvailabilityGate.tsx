import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useDatasetAnalytics } from "../context/DatasetAnalyticsContext";
import NoDataState from "./NoDataState";
import StateBlock from "./StateBlock";

const DataAvailabilityGate = ({ children, moduleName, dashboard = false }: { children: ReactNode; moduleName: string; dashboard?: boolean }) => {
  const { currentUser } = useAuth();
  const { totalRecords, loading, error, refreshAnalytics } = useDatasetAnalytics();

  if (error) return <StateBlock title="Dataset status unavailable" message={error} onRetry={() => void refreshAnalytics()} />;
  if (loading) return <StateBlock title="Loading analytics summary" message="Using the shared CrimePulse AI dataset summary for this module." />;
  if (totalRecords === 0) return <NoDataState currentUser={currentUser} moduleName={moduleName} dashboard={dashboard} />;
  return <>{children}</>;
};

export default DataAvailabilityGate;
