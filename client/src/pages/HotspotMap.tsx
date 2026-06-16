import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, MapPin, RadioTower, RefreshCw, ShieldAlert, Siren } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { mapService } from "../services/mapService";
import type { CrimeHotspot, CrimeMapPoint, DistrictIntensity, MapFilterOptions, MapFilters, MapSummary } from "../types/crime";

const emptyFilters: MapFilters = { fir_year: "All", fir_month: "All", district: "All", police_station: "All", crime_type: "All", severity: "All", fir_stage: "All" };
const emptyOptions: MapFilterOptions = { years: [], months: [], districts: [], policeStations: [], crimeTypes: [], severities: [], statuses: [] };

const riskColor = {
  Low: "#22c55e",
  Medium: "#facc15",
  High: "#f97316",
  Critical: "#ef4444"
};

const karnatakaCenter: [number, number] = [75.6557, 16.1725];
const mapLibreStyle = "https://demotiles.maplibre.org/style.json";
const osmFallbackStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }]
};

const SelectFilter = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select
      className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300"
      value={value || "All"}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="All">All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center justify-between gap-3 rounded border border-command-700 bg-command-850 px-3 py-2 text-sm text-slate-300">
    {label}
    <input className="h-4 w-4 accent-command-300" checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
  </label>
);

const toPointFeatures = (points: CrimeMapPoint[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((point) => ({
    type: "Feature" as const,
    properties: point,
    geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] }
  }))
});

const toDistrictFeatures = (districts: DistrictIntensity[]) => ({
  type: "FeatureCollection" as const,
  features: districts.map((district) => ({
    type: "Feature" as const,
    properties: district,
    geometry: { type: "Point" as const, coordinates: [district.longitude, district.latitude] }
  }))
});

const toHeatFeatures = (heatmap: Array<{ latitude: number; longitude: number; weight: number; district: string; police_station: string; crime_type: string; coordinate_source: string }>) => ({
  type: "FeatureCollection" as const,
  features: heatmap.map((point) => ({
    type: "Feature" as const,
    properties: point,
    geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] }
  }))
});

const hotspotLongitude = (hotspot: CrimeHotspot) => Number(hotspot.longitude ?? hotspot.center_longitude);
const hotspotLatitude = (hotspot: CrimeHotspot) => Number(hotspot.latitude ?? hotspot.center_latitude);
const isValidHotspotCoordinate = (hotspot: CrimeHotspot) => {
  const longitude = hotspotLongitude(hotspot);
  const latitude = hotspotLatitude(hotspot);
  return Number.isFinite(longitude) && Number.isFinite(latitude) && latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
};

const toHotspotFeatures = (hotspots: CrimeHotspot[]) => ({
  type: "FeatureCollection" as const,
  features: hotspots.filter(isValidHotspotCoordinate).map((hotspot) => ({
    type: "Feature" as const,
    properties: {
      ...hotspot,
      longitude: hotspotLongitude(hotspot),
      latitude: hotspotLatitude(hotspot),
      fallback_note: hotspot.coordinate_source === "district_fallback"
        ? "District centroid fallback used because exact coordinates are missing."
        : ""
    },
    geometry: { type: "Point" as const, coordinates: [hotspotLongitude(hotspot), hotspotLatitude(hotspot)] }
  }))
});

const optionList = (options: MapFilterOptions, primary: keyof MapFilterOptions, fallback?: keyof MapFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const HotspotMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const fallbackStyleTried = useRef(false);
  const hotspotMarkers = useRef<maplibregl.Marker[]>([]);
  const [filters, setFilters] = useState<MapFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<MapFilters>(emptyFilters);
  const [options, setOptions] = useState<MapFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<MapSummary | null>(null);
  const [points, setPoints] = useState<CrimeMapPoint[]>([]);
  const [hotspots, setHotspots] = useState<CrimeHotspot[]>([]);
  const [heatmap, setHeatmap] = useState<Array<{ latitude: number; longitude: number; weight: number; district: string; police_station: string; crime_type: string; coordinate_source: "original" | "district_fallback" | "karnataka_fallback" }>>([]);
  const [districts, setDistricts] = useState<DistrictIntensity[]>([]);
  const [stationIntensity, setStationIntensity] = useState<CrimeHotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<CrimeHotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState("");
  const [heatmapLayerFailed, setHeatmapLayerFailed] = useState(false);
  const [hotspotLayerRendered, setHotspotLayerRendered] = useState(false);
  const [storedCount, setStoredCount] = useState<number | null>(null);
  const [layers, setLayers] = useState({
    crimeMarkers: true,
    districtHeat: true,
    hotspotCircles: true,
    redZonePulse: true,
    stationClusters: true
  });

  const hasData = (summary?.total_records || 0) > 0;
  const hasCoordinates = (summary?.records_with_coordinates || 0) > 0;
  const fallbackCount = summary?.records_using_fallback_coordinates ?? summary?.records_without_coordinates ?? 0;

  const popupHtml = (properties: Record<string, unknown>) => `
    <div style="color:#0f172a; min-width:220px">
      <strong>${properties.district || "Unknown"}</strong><br/>
      Station: ${properties.police_station || "N/A"}<br/>
      Crime: ${properties.crime_type || properties.top_crime_type || properties.dominant_crime_type || "N/A"}<br/>
      Count: ${properties.crime_count || 1}<br/>
      Severity/Risk: ${properties.severity || properties.risk_level || properties.intensity_level || "N/A"}<br/>
      Period: ${properties.date || properties.crime_date || "Current filter"}<br/>
      Area: ${properties.location || "District centroid"}<br/>
      Coordinate source: ${properties.coordinate_source || "district_fallback"}<br/>
      ${properties.recommended_action ? `<br/><em>${properties.recommended_action}</em>` : ""}
    </div>
  `;

  const loadMapData = async (nextFilters: MapFilters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [summaryRes, pointsRes, hotspotsRes, heatmapRes, districtsRes, stationRes] = await Promise.all([
        mapService.getSummary(nextFilters),
        mapService.getCrimePoints(nextFilters),
        mapService.getHotspots(nextFilters),
        mapService.getHeatmap(nextFilters),
        mapService.getDistrictIntensity(nextFilters),
        mapService.getPoliceStationIntensity(nextFilters)
      ]);
      setSummary(summaryRes.data);
      setPoints(pointsRes.data);
      setHotspots(hotspotsRes.data);
      setHeatmap(heatmapRes.data);
      setDistricts(districtsRes.data);
      setStationIntensity(stationRes.data);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load hotspot map.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Hotspot Map API failed.` : detail);
      } catch {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStoredCount().then(setStoredCount).catch(() => setStoredCount(null));
    mapService.getFilters().then((response) => setOptions(response.data)).catch(() => setOptions(emptyOptions));
    loadMapData(appliedFilters);
  }, []);

  useEffect(() => {
    if (!hasData || error || !mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapLibreStyle,
      center: karnatakaCenter,
      zoom: 8,
      attributionControl: true
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      setMapLoaded(true);
      setMapError("");
      window.setTimeout(() => map.resize(), 80);
    });
    map.on("style.load", () => {
      setMapLoaded(true);
      window.setTimeout(() => map.resize(), 80);
    });
    map.on("error", (event) => {
      const message = event.error?.message || "MapLibre style or tile load failed.";
      setMapError(message);
      if (!fallbackStyleTried.current) {
        fallbackStyleTried.current = true;
        try {
          setMapLoaded(false);
          map.setStyle(osmFallbackStyle as maplibregl.StyleSpecification);
          setMapError("Primary map style failed. OpenStreetMap fallback style is active.");
        } catch (fallbackError) {
          setMapError(fallbackError instanceof Error ? fallbackError.message : message);
        }
      }
    });

    return () => {
      hotspotMarkers.current.forEach((marker) => marker.remove());
      hotspotMarkers.current = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [hasData, error]);

  const pointGeoJson = useMemo(() => toPointFeatures(points), [points]);
  const districtGeoJson = useMemo(() => toDistrictFeatures(districts), [districts]);
  const heatGeoJson = useMemo(() => toHeatFeatures(heatmap), [heatmap]);
  const hotspotGeoJson = useMemo(() => toHotspotFeatures(hotspots), [hotspots]);
  const firstValidHotspot = useMemo(() => hotspots.find(isValidHotspotCoordinate) || null, [hotspots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateSources = () => {
      if (!map.getSource("crime-points")) {
        map.addSource("crime-points", { type: "geojson", data: pointGeoJson, cluster: true, clusterRadius: 48 });
        map.addLayer({ id: "clusters", type: "circle", source: "crime-points", filter: ["has", "point_count"], paint: { "circle-color": "#2e8bd8", "circle-radius": ["step", ["get", "point_count"], 18, 50, 26, 250, 34], "circle-opacity": 0.85 } });
        map.addLayer({ id: "cluster-count", type: "symbol", source: "crime-points", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#fff" } });
        map.addLayer({ id: "crime-markers", type: "circle", source: "crime-points", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["match", ["get", "severity"], "High", "#f97316", "Critical", "#ef4444", "Medium", "#facc15", "#22c55e"], "circle-radius": ["case", ["!=", ["get", "coordinate_source"], "original"], 8, 5], "circle-stroke-width": ["case", ["!=", ["get", "coordinate_source"], "original"], 3, 1], "circle-stroke-color": ["case", ["!=", ["get", "coordinate_source"], "original"], "#94a3b8", "#fff"], "circle-opacity": ["case", ["!=", ["get", "coordinate_source"], "original"], 0.65, 0.9] } });
        map.on("click", "crime-markers", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          new maplibregl.Popup().setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number]).setHTML(popupHtml(feature.properties || {})).addTo(map);
        });
      } else {
        (map.getSource("crime-points") as GeoJSONSource).setData(pointGeoJson);
      }

      if (!map.getSource("district-intensity")) {
        map.addSource("district-intensity", { type: "geojson", data: districtGeoJson });
        map.addLayer({ id: "district-heat", type: "circle", source: "district-intensity", paint: { "circle-color": ["match", ["get", "intensity_level"], "Critical", "#ef4444", "High", "#f97316", "Medium", "#facc15", "#22c55e"], "circle-radius": ["interpolate", ["linear"], ["get", "crime_count"], 1, 14, 500, 48], "circle-opacity": 0.34 } });
        map.on("click", "district-heat", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          new maplibregl.Popup().setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number]).setHTML(popupHtml(feature.properties || {})).addTo(map);
        });
      } else {
        (map.getSource("district-intensity") as GeoJSONSource).setData(districtGeoJson);
      }

      if (!map.getSource("hotspots")) {
        map.addSource("hotspots", { type: "geojson", data: hotspotGeoJson });
        map.addLayer({
          id: "hotspot-circles",
          type: "circle",
          source: "hotspots",
          paint: {
            "circle-color": ["match", ["get", "risk_level"], "Critical", "#ef4444", "High", "#f97316", "Medium", "#facc15", "#22c55e"],
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "intensity_score"], ["get", "crime_count"]], 1, 16, 80, 42],
            "circle-opacity": 0.72,
            "circle-stroke-width": ["case", ["!=", ["get", "coordinate_source"], "original"], 4, 2],
            "circle-stroke-color": ["case", ["!=", ["get", "coordinate_source"], "original"], "#ffffff", "#0f172a"],
            "circle-stroke-opacity": 0.9
          }
        });
        map.on("click", "hotspot-circles", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const properties = feature.properties || {};
          const popup = `
            <div style="color:#0f172a; min-width:230px">
              <strong>${properties.district || "Unknown"}</strong><br/>
              Police Station: ${properties.police_station || "N/A"}<br/>
              Crime Count: ${properties.crime_count || 0}<br/>
              Risk Level: ${properties.risk_level || "N/A"}<br/>
              Top Crime Type: ${properties.top_crime_type || properties.dominant_crime_type || "N/A"}<br/>
              Coordinate Source: ${properties.coordinate_source || "N/A"}<br/>
              ${properties.fallback_note ? `<br/><em>${properties.fallback_note}</em>` : ""}
            </div>
          `;
          new maplibregl.Popup().setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number]).setHTML(popup).addTo(map);
        });
        setHotspotLayerRendered(true);
      } else {
        (map.getSource("hotspots") as GeoJSONSource).setData(hotspotGeoJson);
        setHotspotLayerRendered(hotspotGeoJson.features.length > 0);
      }

      try {
        if (!map.getSource("crime-heatmap")) {
          map.addSource("crime-heatmap", { type: "geojson", data: heatGeoJson });
          map.addLayer({
            id: "crime-heatmap-layer",
            type: "heatmap",
            source: "crime-heatmap",
            paint: {
              "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
              "heatmap-intensity": 1.25,
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 18, 9, 42],
              "heatmap-opacity": 0.55,
              "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.25, "#00d4ff", 0.5, "#facc15", 0.75, "#f97316", 1, "#ef4444"]
            }
          }, map.getLayer("crime-markers") ? "crime-markers" : undefined);
        } else {
          (map.getSource("crime-heatmap") as GeoJSONSource).setData(heatGeoJson);
        }
      } catch (heatmapError) {
        setHeatmapLayerFailed(true);
        console.warn("MapLibre heatmap layer failed; circle markers remain active.", heatmapError);
      }
    };

    if (map.loaded()) updateSources();
    else map.once("load", updateSources);
  }, [pointGeoJson, districtGeoJson, heatGeoJson, hotspotGeoJson, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setVisibility = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    setVisibility("crime-markers", layers.crimeMarkers);
    setVisibility("district-heat", layers.districtHeat);
    setVisibility("crime-heatmap-layer", layers.districtHeat);
    setVisibility("hotspot-circles", layers.hotspotCircles);
    setVisibility("clusters", layers.stationClusters);
    setVisibility("cluster-count", layers.stationClusters);
  }, [layers, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    hotspotMarkers.current.forEach((marker) => marker.remove());
    hotspotMarkers.current = [];
    if (!layers.hotspotCircles && !layers.redZonePulse) return;
    hotspots.forEach((hotspot) => {
      const element = document.createElement("button");
      element.type = "button";
      element.style.width = `${Math.min(54, 18 + hotspot.crime_count)}px`;
      element.style.height = element.style.width;
      element.style.borderRadius = "999px";
      element.style.border = `2px solid ${riskColor[hotspot.risk_level]}`;
      element.style.background = `${riskColor[hotspot.risk_level]}55`;
      if (hotspot.coordinate_source !== "original") element.style.outline = "2px dashed rgba(255,255,255,0.65)";
      element.style.boxShadow = ["High", "Critical"].includes(hotspot.risk_level) && layers.redZonePulse ? `0 0 0 10px ${riskColor[hotspot.risk_level]}22` : "none";
      element.className = ["High", "Critical"].includes(hotspot.risk_level) && layers.redZonePulse ? "animate-pulse" : "";
      const longitude = hotspotLongitude(hotspot);
      const latitude = hotspotLatitude(hotspot);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
      element.addEventListener("click", () => {
        setSelectedHotspot(hotspot);
        new maplibregl.Popup().setLngLat([longitude, latitude]).setHTML(popupHtml(hotspot as unknown as Record<string, unknown>)).addTo(map);
      });
      hotspotMarkers.current.push(new maplibregl.Marker({ element }).setLngLat([longitude, latitude]).addTo(map));
    });
  }, [hotspots, layers.hotspotCircles, layers.redZonePulse, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || hotspots.length === 0) return;
    const validHotspots = hotspots.filter(isValidHotspotCoordinate);
    if (validHotspots.length === 0) return;
    window.setTimeout(() => map.resize(), 50);
    if (validHotspots.length === 1) {
      map.flyTo({ center: [hotspotLongitude(validHotspots[0]), hotspotLatitude(validHotspots[0])], zoom: 9, duration: 700 });
      return;
    }
    const bounds = validHotspots.reduce(
      (acc, hotspot) => acc.extend([hotspotLongitude(hotspot), hotspotLatitude(hotspot)]),
      new maplibregl.LngLatBounds([hotspotLongitude(validHotspots[0]), hotspotLatitude(validHotspots[0])], [hotspotLongitude(validHotspots[0]), hotspotLatitude(validHotspots[0])])
    );
    map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 700 });
  }, [hotspots, mapLoaded]);

  const updateFilter = (key: keyof MapFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading && !summary) return <StateBlock title="Loading Hotspot Map" message="Fetching summarized map intelligence from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock
          title="Hotspot map unavailable"
          message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV records first to activate the Hotspot Map."}
        />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Map API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadMapData(appliedFilters)} type="button">
            Retry Map
          </button>
        </div>
      </div>
    );
  }
  if (!hasData) return <StateBlock title="No crime data available" message="Upload CSV records first to activate the Hotspot Map." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Karnataka Crime Hotspot Map</p>
          <h1 className="text-3xl font-semibold text-white">Interactive Crime Intensity Map</h1>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadMapData(appliedFilters)} type="button">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Map
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardCard title="Total Mapped Crimes" value={summary?.total_records || 0} icon={MapPin} />
        <DashboardCard title="With Coordinates" value={summary?.records_with_coordinates || 0} icon={RadioTower} tone="green" />
        <DashboardCard title="Fallback Coordinates" value={fallbackCount} icon={ShieldAlert} tone="orange" />
        <DashboardCard title="Active Hotspots" value={summary?.hotspot_count || summary?.active_hotspots || 0} icon={Siren} tone="red" />
        <DashboardCard title="Highest Intensity District" value={summary?.highest_intensity_district || summary?.highest_risk_district || "No data"} icon={Layers} />
        <DashboardCard title="Common Mapped Crime" value={summary?.most_common_mapped_crime_type || "No data"} icon={ShieldAlert} tone="orange" />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-4 text-sm text-slate-300 shadow-glow">
        {fallbackCount > 0
          ? "Exact coordinates are unavailable for this dataset. Showing district-level hotspot using centroid fallback."
          : "All plotted records in this view include exact coordinates."}
        {!hasCoordinates && " No exact coordinate records were found, so the map is using district-level fallback hotspots."}
        {summary?.coordinate_available_percentage !== undefined ? ` Coordinate availability: ${summary.coordinate_available_percentage}%.` : ""}
      </section>

      <section className="grid gap-3 rounded-md border border-command-700 bg-command-900/85 p-4 text-xs text-slate-300 shadow-glow sm:grid-cols-2 xl:grid-cols-6">
        <div><span className="text-slate-500">API summary loaded:</span> {summary ? "yes" : "no"}</div>
        <div><span className="text-slate-500">Hotspots:</span> {hotspots.length}</div>
        <div><span className="text-slate-500">Heatmap points:</span> {heatmap.length}</div>
        <div><span className="text-slate-500">Crime points:</span> {points.length}</div>
        <div><span className="text-slate-500">Fallback used:</span> {fallbackCount > 0 || summary?.fallback_used ? "yes" : "no"}</div>
        <div><span className="text-slate-500">Map loaded:</span> {mapLoaded ? "yes" : "no"}</div>
        <div><span className="text-slate-500">First hotspot coordinates:</span> {firstValidHotspot ? `${hotspotLatitude(firstValidHotspot)}, ${hotspotLongitude(firstValidHotspot)}` : "none"}</div>
        <div><span className="text-slate-500">Rendered layer:</span> {hotspotLayerRendered ? "yes" : "no"}</div>
        {(mapError || heatmapLayerFailed || (storedCount && storedCount > 0 && points.length === 0)) && (
          <div className="break-words text-alert-high sm:col-span-2 xl:col-span-6">
            {mapError ? `Map message: ${mapError}` : ""}
            {heatmapLayerFailed ? " Heatmap layer failed; circle markers are active." : ""}
            {storedCount && storedCount > 0 && points.length === 0 ? " Records found, but map coordinates could not be generated." : ""}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Filters</h2>
            <div className="mt-4 space-y-4">
              <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
              <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
              <SelectFilter label="District" value={filters.district} options={optionList(options, "districts", "district")} onChange={(value) => updateFilter("district", value)} />
              <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations", "police_station")} onChange={(value) => updateFilter("police_station", value)} />
              <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes", "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
              <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities", "severity")} onChange={(value) => updateFilter("severity", value)} />
              <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses", "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
            </div>
            <div className="mt-5 flex gap-3">
              <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => { setAppliedFilters(filters); loadMapData(filters); }} type="button">Apply</button>
              <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); loadMapData(emptyFilters); }} type="button">Clear</button>
            </div>
          </section>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Map Layers</h2>
            <div className="mt-4 space-y-2">
              <Toggle label="Crime Markers" checked={layers.crimeMarkers} onChange={(value) => setLayers((current) => ({ ...current, crimeMarkers: value }))} />
              <Toggle label="District Heat Intensity" checked={layers.districtHeat} onChange={(value) => setLayers((current) => ({ ...current, districtHeat: value }))} />
              <Toggle label="Hotspot Circles" checked={layers.hotspotCircles} onChange={(value) => setLayers((current) => ({ ...current, hotspotCircles: value }))} />
              <Toggle label="Red-Zone Pulse Alerts" checked={layers.redZonePulse} onChange={(value) => setLayers((current) => ({ ...current, redZonePulse: value }))} />
              <Toggle label="Police Station Clusters" checked={layers.stationClusters} onChange={(value) => setLayers((current) => ({ ...current, stationClusters: value }))} />
            </div>
          </section>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Map Legend</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {Object.entries(riskColor).map(([level, color]) => (
                <div key={level} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                  {level}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <span className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300 bg-slate-500/40" />
                District centroid fallback
              </div>
            </div>
          </section>
        </aside>

        <section className="relative min-h-[650px] overflow-hidden rounded-md border border-command-700 bg-command-900 shadow-glow xl:min-h-[calc(100vh-220px)]">
          <div ref={mapContainer} className="absolute inset-0 h-full min-h-[650px] w-full" />
          {loading && <div className="absolute left-4 top-4 rounded border border-command-700 bg-command-900/90 px-3 py-2 text-sm text-slate-300">Updating map...</div>}
          {fallbackCount > 0 && (
            <div className="absolute right-4 top-4 rounded border border-alert-high/40 bg-command-900/90 px-3 py-2 text-sm text-alert-high">
              District centroid fallback
            </div>
          )}
          {!mapLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-command-950/70 text-sm text-slate-300">
              Loading Karnataka map tiles...
            </div>
          )}
          {(mapError && !mapLoaded && firstValidHotspot) && (
            <div className="absolute inset-6 flex items-center justify-center rounded-md border border-alert-high/40 bg-command-950/95 p-6 text-center shadow-glow">
              <div>
                <p className="text-lg font-semibold text-white">Map renderer failed, but hotspot data is available.</p>
                <p className="mt-3 text-sm text-slate-300">{firstValidHotspot.district} - {firstValidHotspot.police_station}</p>
                <p className="mt-1 text-sm text-slate-300">Crime count: {firstValidHotspot.crime_count}</p>
                <p className="mt-1 text-sm text-slate-300">Risk: {firstValidHotspot.risk_level}</p>
                <p className="mt-1 text-sm text-slate-300">Coordinates: {hotspotLatitude(firstValidHotspot)}, {hotspotLongitude(firstValidHotspot)}</p>
                <p className="mt-3 text-xs text-alert-high">{mapError}</p>
              </div>
            </div>
          )}
          {points.length === 0 && hasData && (
            <div className="absolute bottom-4 left-4 right-4 rounded border border-command-700 bg-command-900/90 px-4 py-3 text-sm text-slate-300">
              No individual point markers match this view. District intensity centroids remain active.
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">District Intensity</h2>
          <div className="mt-4 max-h-96 overflow-y-auto">
            {districts.slice(0, 12).map((district) => (
              <div key={district.district} className="mb-3 rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{district.district}</span>
                  <span className="rounded border px-2 py-1 text-xs" style={{ borderColor: riskColor[district.risk_level || district.intensity_level], color: riskColor[district.risk_level || district.intensity_level] }}>{district.risk_level || district.intensity_level}</span>
                </div>
                <p className="mt-2">Crimes: {district.crime_count} | Stations: {district.police_station_count || 0}</p>
                <p>Top crime: {district.top_crime_type || district.dominant_crime_type}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Police Station Hotspots</h2>
          <div className="mt-4 max-h-96 overflow-y-auto">
            {stationIntensity.slice(0, 12).map((hotspot) => (
              <button key={hotspot.hotspot_id} className="mb-3 block w-full rounded border border-command-700 bg-command-850 p-3 text-left text-sm text-slate-300 hover:border-command-300" onClick={() => setSelectedHotspot(hotspot)} type="button">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{hotspot.police_station}</span>
                  <span className="rounded border px-2 py-1 text-xs" style={{ borderColor: riskColor[hotspot.risk_level], color: riskColor[hotspot.risk_level] }}>{hotspot.risk_level}</span>
                </div>
                <p className="mt-2">{hotspot.district} | Crimes: {hotspot.crime_count}</p>
                <p>Top crime: {hotspot.top_crime_type || hotspot.dominant_crime_type}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selectedHotspot && (
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-command-300">Selected Hotspot</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{selectedHotspot.police_station}</h2>
              <p className="mt-1 text-sm text-slate-400">{selectedHotspot.district}</p>
            </div>
            <span className="rounded border px-3 py-2 text-sm font-semibold" style={{ borderColor: riskColor[selectedHotspot.risk_level], color: riskColor[selectedHotspot.risk_level] }}>{selectedHotspot.risk_level}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Crime count: <span className="text-white">{selectedHotspot.crime_count}</span></div>
            <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Heinous: <span className="text-white">{selectedHotspot.heinous_count || 0}</span></div>
            <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Intensity: <span className="text-white">{selectedHotspot.intensity_score || selectedHotspot.risk_score}</span></div>
            <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Coordinates: <span className="text-white">{selectedHotspot.coordinate_source === "original" ? "Exact/averaged" : "District fallback"}</span></div>
          </div>
          <p className="mt-4 rounded border border-command-700 bg-command-850 p-3 text-sm text-command-300">{selectedHotspot.recommended_action}</p>
        </section>
      )}
    </div>
  );
};

export default HotspotMap;
