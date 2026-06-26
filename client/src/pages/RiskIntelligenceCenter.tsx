import DecisionCenterTabs from "../components/DecisionCenterTabs";
import DistrictRiskDna from "./DistrictRiskDna";
import DistrictAnalytics from "./DistrictAnalytics";
import RiskIntelligence from "./RiskIntelligence";

const RiskIntelligenceCenter = () => <DecisionCenterTabs title="Risk Intelligence Center" purpose="Compare districts and police stations, understand risk profiles, and prioritize action." tabs={[{ id: "overview", label: "Overview", route: "/risk-intelligence", content: <RiskIntelligence /> }, { id: "district-risk-dna", label: "District Risk DNA", route: "/district-risk-dna", content: <DistrictRiskDna /> }, { id: "district-analytics", label: "District Analytics", route: "/district-analytics", content: <DistrictAnalytics /> }, { id: "priority-actions", label: "Priority Actions", route: "/risk-intelligence", content: <RiskIntelligence /> }]} />;

export default RiskIntelligenceCenter;
