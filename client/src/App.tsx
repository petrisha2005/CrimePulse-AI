import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AiInsights from "./pages/AiInsights";
import AiReport from "./pages/AiReport";
import Alerts from "./pages/Alerts";
import ComingSoon from "./pages/ComingSoon";
import CrimeForecast from "./pages/CrimeForecast";
import CrimeRecordsPage from "./pages/CrimeRecordsPage";
import CrimeTimeMachine from "./pages/CrimeTimeMachine";
import Dashboard from "./pages/Dashboard";
import DistrictAnalytics from "./pages/DistrictAnalytics";
import DistrictRiskDna from "./pages/DistrictRiskDna";
import HomePage from "./pages/HomePage";
import HotspotMap from "./pages/HotspotMap";
import Login from "./pages/Login";
import PatternDiscovery from "./pages/PatternDiscovery";
import PresentationMode from "./pages/PresentationMode";
import RiskIntelligence from "./pages/RiskIntelligence";
import SocioEconomicInsights from "./pages/SocioEconomicInsights";
import UploadCrimeData from "./pages/UploadCrimeData";

const App = () => (
  <Routes>
    <Route path="/home" element={<HomePage />} />
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<UploadCrimeData />} />
        <Route path="/district-risk-dna" element={<DistrictRiskDna />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/hotspot-map" element={<HotspotMap />} />
        <Route path="/crime-time-machine" element={<CrimeTimeMachine />} />
        <Route path="/crime-forecast" element={<CrimeForecast />} />
        <Route path="/socio-economic-insights" element={<SocioEconomicInsights />} />
        <Route path="/pattern-discovery" element={<PatternDiscovery />} />
        <Route path="/ai-insights" element={<AiInsights />} />
        <Route path="/ai-report" element={<AiReport />} />
        <Route path="/presentation-mode" element={<PresentationMode />} />
        <Route path="/records" element={<CrimeRecordsPage />} />
        <Route path="/district-analytics" element={<DistrictAnalytics />} />
        <Route path="/risk-intelligence" element={<RiskIntelligence />} />
        <Route path="/reports" element={<ComingSoon title="Reports" />} />
      </Route>
    </Route>
    <Route path="/" element={<HomePage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;
