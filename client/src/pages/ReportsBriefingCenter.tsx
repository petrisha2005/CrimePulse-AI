import DecisionCenterTabs from "../components/DecisionCenterTabs";
import AiReport from "./AiReport";
import Reports from "./Reports";

const ReportsBriefingCenter = () => <DecisionCenterTabs title="Reports & AI Briefing" purpose="Generate, view, download, print, and manage intelligence reports." tabs={[{ id: "generate", label: "Generate Report", route: "/ai-report", content: <AiReport /> }, { id: "recent", label: "Recent Reports", route: "/reports", content: <Reports /> }, { id: "downloads", label: "Print / Download", route: "/reports", content: <Reports /> }]} />;

export default ReportsBriefingCenter;
