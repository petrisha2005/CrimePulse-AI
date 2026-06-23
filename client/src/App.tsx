import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import AppLayout from "./components/AppLayout";
import DataAvailabilityGate from "./components/DataAvailabilityGate";
import { PageTransition } from "./components/animation";
import AnimatedPageShell from "./components/layout/AnimatedPageShell";
import ProtectedRoute from "./components/ProtectedRoute";
import AiInsights from "./pages/AiInsights";
import AiReport from "./pages/AiReport";
import Alerts from "./pages/Alerts";
import CrimeForecast from "./pages/CrimeForecast";
import CrimeRecordsPage from "./pages/CrimeRecordsPage";
import CrimeTimeMachine from "./pages/CrimeTimeMachine";
import Dashboard from "./pages/Dashboard";
import DistrictAnalytics from "./pages/DistrictAnalytics";
import DistrictRiskDna from "./pages/DistrictRiskDna";
import LandingPage from "./pages/LandingPage";
import HotspotMap from "./pages/HotspotMap";
import Login from "./pages/Login";
import PatternDiscovery from "./pages/PatternDiscovery";
import PresentationMode from "./pages/PresentationMode";
import RiskIntelligence from "./pages/RiskIntelligence";
import Reports from "./pages/Reports";
import SocioEconomicInsights from "./pages/SocioEconomicInsights";
import UploadCrimeData from "./pages/UploadCrimeData";

const Shell = ({ variant, children }: { variant: Parameters<typeof AnimatedPageShell>[0]["backgroundVariant"]; children: ReactNode }) => <AnimatedPageShell backgroundVariant={variant}>{children}</AnimatedPageShell>;

const App = () => {
  const location = useLocation();
  return <PageTransition pageKey={location.pathname}><Routes>
    <Route path="/home" element={<LandingPage />} />
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Shell variant="dashboard"><DataAvailabilityGate dashboard moduleName="Dashboard"><Dashboard /></DataAvailabilityGate></Shell>} />
        <Route path="/upload" element={<Shell variant="upload"><UploadCrimeData /></Shell>} />
        <Route path="/district-risk-dna" element={<Shell variant="district-risk-dna"><DataAvailabilityGate moduleName="District Risk DNA"><DistrictRiskDna /></DataAvailabilityGate></Shell>} />
        <Route path="/alerts" element={<Shell variant="red-zone-alerts"><DataAvailabilityGate moduleName="Red-Zone Alerts"><Alerts /></DataAvailabilityGate></Shell>} />
        <Route path="/hotspot-map" element={<Shell variant="hotspot-map"><DataAvailabilityGate moduleName="Hotspot Map"><HotspotMap /></DataAvailabilityGate></Shell>} />
        <Route path="/crime-time-machine" element={<Shell variant="crime-time-machine"><DataAvailabilityGate moduleName="Crime Time Machine"><CrimeTimeMachine /></DataAvailabilityGate></Shell>} />
        <Route path="/crime-forecast" element={<Shell variant="crime-forecast"><DataAvailabilityGate moduleName="Crime Forecast"><CrimeForecast /></DataAvailabilityGate></Shell>} />
        <Route path="/socio-economic-insights" element={<Shell variant="socio-economic-insights"><DataAvailabilityGate moduleName="Socio-Economic Insights"><SocioEconomicInsights /></DataAvailabilityGate></Shell>} />
        <Route path="/pattern-discovery" element={<Shell variant="pattern-discovery"><DataAvailabilityGate moduleName="Pattern Discovery"><PatternDiscovery /></DataAvailabilityGate></Shell>} />
        <Route path="/ai-insights" element={<Shell variant="ai-insights"><DataAvailabilityGate moduleName="AI Insights"><AiInsights /></DataAvailabilityGate></Shell>} />
        <Route path="/ai-report" element={<Shell variant="ai-report-generator"><DataAvailabilityGate moduleName="AI Report Generator"><AiReport /></DataAvailabilityGate></Shell>} />
        <Route path="/presentation-mode" element={<Shell variant="presentation"><PresentationMode /></Shell>} />
        <Route path="/records" element={<Shell variant="records"><DataAvailabilityGate moduleName="Crime Records"><CrimeRecordsPage /></DataAvailabilityGate></Shell>} />
        <Route path="/district-analytics" element={<Shell variant="district-analytics"><DataAvailabilityGate moduleName="District Analytics"><DistrictAnalytics /></DataAvailabilityGate></Shell>} />
        <Route path="/risk-intelligence" element={<Shell variant="risk-intelligence"><DataAvailabilityGate moduleName="Risk Intelligence"><RiskIntelligence /></DataAvailabilityGate></Shell>} />
        <Route path="/reports" element={<Shell variant="report"><DataAvailabilityGate moduleName="Reports"><Reports /></DataAvailabilityGate></Shell>} />
        {/* Legacy internal QA routes stay inaccessible in the final demo. */}
        <Route path="/submission-check" element={<Navigate to="/dashboard" replace />} />
        <Route path="/release-readiness" element={<Navigate to="/dashboard" replace />} />
        <Route path="/pre-submission" element={<Navigate to="/dashboard" replace />} />
        <Route path="/diagnostics-submission" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Route>
    <Route path="/" element={<LandingPage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></PageTransition>;
};

export default App;
