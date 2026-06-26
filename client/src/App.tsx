import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import AppLayout from "./components/AppLayout";
import DataAvailabilityGate from "./components/DataAvailabilityGate";
import { PageTransition } from "./components/animation";
import AnimatedPageShell from "./components/layout/AnimatedPageShell";
import ProtectedRoute from "./components/ProtectedRoute";
import AiInsights from "./pages/AiInsights";
import CrimeRecordsPage from "./pages/CrimeRecordsPage";
import AlertsPatternsCenter from "./pages/AlertsPatternsCenter";
import CrimeTrendHotspotCenter from "./pages/CrimeTrendHotspotCenter";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import PresentationMode from "./pages/PresentationMode";
import ReportsBriefingCenter from "./pages/ReportsBriefingCenter";
import RiskIntelligenceCenter from "./pages/RiskIntelligenceCenter";
import SocioEconomicInsights from "./pages/SocioEconomicInsights";
import UploadCrimeData from "./pages/UploadCrimeData";

const Shell = ({ variant, children }: { variant: Parameters<typeof AnimatedPageShell>[0]["backgroundVariant"]; children: ReactNode }) => <AnimatedPageShell backgroundVariant={variant}>{children}</AnimatedPageShell>;

const App = () => {
  const location = useLocation();
  return <PageTransition pageKey={location.pathname}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/home" element={<LandingPage />} />
    <Route path="/index.html" element={<LandingPage />} />
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Shell variant="dashboard"><DataAvailabilityGate dashboard moduleName="Dashboard"><Dashboard /></DataAvailabilityGate></Shell>} />
        <Route path="/upload" element={<Shell variant="upload"><UploadCrimeData /></Shell>} />
        <Route path="/risk-intelligence-center" element={<Shell variant="risk-intelligence"><DataAvailabilityGate moduleName="Risk Intelligence Center"><RiskIntelligenceCenter /></DataAvailabilityGate></Shell>} />
        <Route path="/alerts-patterns" element={<Shell variant="red-zone-alerts"><DataAvailabilityGate moduleName="Alerts & Pattern Detection"><AlertsPatternsCenter /></DataAvailabilityGate></Shell>} />
        <Route path="/crime-trend-hotspot" element={<Shell variant="hotspot-map"><DataAvailabilityGate moduleName="Crime Trend & Hotspot Explorer"><CrimeTrendHotspotCenter /></DataAvailabilityGate></Shell>} />
        <Route path="/socio-economic-insights" element={<Shell variant="socio-economic-insights"><DataAvailabilityGate moduleName="Socio-Economic Insights"><SocioEconomicInsights /></DataAvailabilityGate></Shell>} />
        <Route path="/ai-insights" element={<Shell variant="ai-insights"><DataAvailabilityGate moduleName="AI Insights"><AiInsights /></DataAvailabilityGate></Shell>} />
        <Route path="/reports-briefing" element={<Shell variant="report"><DataAvailabilityGate moduleName="Reports & AI Briefing"><ReportsBriefingCenter /></DataAvailabilityGate></Shell>} />
        <Route path="/presentation-mode" element={<Shell variant="presentation"><PresentationMode /></Shell>} />
        <Route path="/records" element={<Shell variant="records"><DataAvailabilityGate moduleName="Crime Records"><CrimeRecordsPage /></DataAvailabilityGate></Shell>} />
        <Route path="/district-risk-dna" element={<Navigate to="/risk-intelligence-center" replace />} />
        <Route path="/district-analytics" element={<Navigate to="/risk-intelligence-center" replace />} />
        <Route path="/risk-intelligence" element={<Navigate to="/risk-intelligence-center" replace />} />
        <Route path="/alerts" element={<Navigate to="/alerts-patterns" replace />} />
        <Route path="/red-zone-alerts" element={<Navigate to="/alerts-patterns" replace />} />
        <Route path="/pattern-discovery" element={<Navigate to="/alerts-patterns" replace />} />
        <Route path="/hotspot-map" element={<Navigate to="/crime-trend-hotspot" replace />} />
        <Route path="/crime-time-machine" element={<Navigate to="/crime-trend-hotspot" replace />} />
        <Route path="/crime-forecast" element={<Navigate to="/crime-trend-hotspot" replace />} />
        <Route path="/ai-report" element={<Navigate to="/reports-briefing" replace />} />
        <Route path="/reports" element={<Navigate to="/reports-briefing" replace />} />
        {/* Legacy internal QA routes stay inaccessible in the final demo. */}
        <Route path="/submission-check" element={<Navigate to="/dashboard" replace />} />
        <Route path="/release-readiness" element={<Navigate to="/dashboard" replace />} />
        <Route path="/pre-submission" element={<Navigate to="/dashboard" replace />} />
        <Route path="/diagnostics-submission" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></PageTransition>;
};

export default App;
