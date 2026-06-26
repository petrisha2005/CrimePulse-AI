import DecisionCenterTabs from "../components/DecisionCenterTabs";
import Alerts from "./Alerts";
import PatternDiscovery from "./PatternDiscovery";

const AlertsPatternsCenter = () => <DecisionCenterTabs title="Alerts & Pattern Detection" purpose="Detect urgent red-zone signals, repeated patterns, and emerging crime behavior." tabs={[{ id: "alerts", label: "Red-Zone Alerts", route: "/alerts", content: <Alerts /> }, { id: "patterns", label: "Hidden Patterns", route: "/pattern-discovery", content: <PatternDiscovery /> }, { id: "signals", label: "Emerging Signals", route: "/alerts", content: <Alerts /> }]} />;

export default AlertsPatternsCenter;
