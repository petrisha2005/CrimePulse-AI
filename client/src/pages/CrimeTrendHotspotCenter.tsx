import DecisionCenterTabs from "../components/DecisionCenterTabs";
import CrimeForecast from "./CrimeForecast";
import CrimeTimeMachine from "./CrimeTimeMachine";
import HotspotMap from "./HotspotMap";

const CrimeTrendHotspotCenter = () => <DecisionCenterTabs title="Crime Trend & Hotspot Explorer" purpose="Explore where crime is concentrated, how it changes over time, and what future risks may emerge." tabs={[{ id: "hotspot-map", label: "Hotspot Map", route: "/hotspot-map", content: <HotspotMap /> }, { id: "time-trends", label: "Time Trends", route: "/crime-time-machine", content: <CrimeTimeMachine /> }, { id: "forecast", label: "Forecast", route: "/crime-forecast", content: <CrimeForecast /> }]} />;

export default CrimeTrendHotspotCenter;
