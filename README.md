# CrimePulse AI

CrimePulse AI is a Zoho Catalyst-ready AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police.

CrimePulse AI transforms Karnataka Police crime records into a live intelligence command center that detects hotspots, predicts risk, explains crime patterns, and recommends preventive action.

## Problem Statement

Manual crime records make it difficult to detect hidden crime patterns, compare districts, identify emerging risks, and generate timely intelligence reports for police leadership.

## Solution

CrimePulse AI uses Zoho Catalyst Functions and Data Store to aggregate real uploaded crime records, then presents explainable crime intelligence through React dashboards and AI-assisted reporting. AI explanations are generated only from calculated analytics and do not invent statistics.

## Key Features

- Secure Catalyst Authentication login flow
- CSV upload for Karnataka crime data
- Crime Command Dashboard with KPIs, trends, charts, rankings, filters, and CSV export
- District Risk DNA with explainable risk score engine
- Red-Zone Pulse Alerts and anomaly detection
- Hotspot Map using MapLibre
- Crime Time Machine for period comparison
- Crime Weather Forecast
- Socio-Economic Insights
- Pattern Discovery Engine
- AI Story Mode and Heat-to-Action recommendations
- AI Intelligence Report PDF generator
- Hackathon Presentation Mode for guided judging
- Global dataset status widget

## Unique Innovations

- District Risk DNA for explainable district intelligence
- Red-Zone Pulse Alerts for unusual spikes
- Crime Time Machine for temporal comparison
- Crime Weather Forecast for near-term risk awareness
- Heat-to-Action recommendations for field deployment
- Pattern Whisper alerts for short operational signals
- AI reports grounded only in calculated Catalyst analytics

## Tech Stack

- Frontend: React, TypeScript, Tailwind CSS
- Charts: Recharts
- Maps: MapLibre
- Backend: Zoho Catalyst Serverless Functions with Node.js
- Database: Zoho Catalyst Data Store
- Authentication: Zoho Catalyst Authentication
- Hosting: Zoho Catalyst Web Client Hosting
- AI explanations: Gemini API with rule-based fallback

This project does not use Vercel, Firebase, FastAPI, Express, or MongoDB.

## Catalyst Setup

Install the Catalyst CLI:

```bash
npm install -g zcatalyst-cli
```

Log in:

```bash
catalyst login
```

Initialize from the project folder:

```bash
cd kavach-analytics
catalyst init
```

Enable:

- Functions
- Web Client
- Data Store
- Authentication

## Environment Variables

Copy `.env.example` to `client/.env` and configure the Catalyst project values:

```text
VITE_CATALYST_PROJECT_ID=your_catalyst_project_id
VITE_CATALYST_ENVIRONMENT=Development
VITE_CRIME_API_BASE=/server/crime-api
VITE_DASHBOARD_API_BASE=/server/dashboard-api
VITE_RISK_API_BASE=/server/risk-api
VITE_ALERT_API_BASE=/server/alert-api
VITE_MAP_API_BASE=/server/map-api
VITE_TIME_MACHINE_API_BASE=/server/time-machine-api
VITE_FORECAST_API_BASE=/server/forecast-api
VITE_SOCIO_ECONOMIC_API_BASE=/server/socio-economic-api
VITE_PATTERN_API_BASE=/server/pattern-api
VITE_REPORT_API_BASE=/server/report-api
VITE_AI_API_BASE=/server/ai-api
```

Configure Catalyst Function environment variables:

```text
CRIME_RECORDS_TABLE=CrimeRecords
GEMINI_API_KEY=your_gemini_api_key
```

If `GEMINI_API_KEY` is omitted, AI report and insight modules generate rule-based fallback text.

## Data Store Tables

Create `CrimeRecords` in Zoho Catalyst Data Store with:

```text
crime_id, district, police_station, crime_type, crime_subtype, severity,
severity_original, fir_year, fir_month, fir_day, crime_date, latitude_value, longitude_value,
offence_location, beat_name, village_area_name, fir_stage, complaint_mode,
act_section, victim_count, accused_count, arrested_count, conviction_count,
unit_id, created_time
```

Create `AIInsights` with:

```text
insight_id, insight_type, title, district, crime_type, year, month,
input_summary, generated_text, recommendations, generated_at
```

Create `AIReports` if using PDF report history:

```text
report_id, report_title, report_type, district, generated_at,
pdf_file_id_or_path
```

## Demo Login

Hackathon-only demo roles:

```text
Super Admin: admin@crimepulse.ai / Admin@123
District Command Officer: district@crimepulse.ai / District@123
Police Station Officer: station@crimepulse.ai / Station@123
Crime Analyst: analyst@crimepulse.ai / Analyst@123
```

These local credentials are for the demo flow only. Replace them with Catalyst Authentication role claims before production deployment.

## Install Dependencies

Install client dependencies:

```bash
cd client
npm install
```

Install function dependencies:

```bash
cd ../functions/crime-api && npm install
cd ../dashboard-api && npm install
cd ../risk-api && npm install
cd ../alert-api && npm install
cd ../map-api && npm install
cd ../time-machine-api && npm install
cd ../forecast-api && npm install
cd ../socio-economic-api && npm install
cd ../pattern-api && npm install
cd ../report-api && npm install
cd ../ai-api && npm install
```

## Run Locally

From the project root:

```bash
catalyst serve
```

For Vite-only UI preview:

```bash
cd client
npm run dev -- --host 127.0.0.1
```

Vite-only preview uses safe empty local fallbacks when Catalyst Functions are not mounted. Use `catalyst serve` for live Catalyst Data Store data.

## Upload Sample CSV

Use `sample-crime-data.csv` for a small test upload first. The real dataset can be large, so validate with a 1000-row sample before importing the full file.

Required source columns:

```text
District_Name, UnitName, FIR_YEAR, FIR_MONTH, FIR_Day, CrimeGroup_Name
```

Latitude and longitude may be missing. Rows are still inserted for district-level analytics.

## APIs

### crime-api

- `GET /crimes`
- `POST /crimes`
- `PUT /crimes/:ROWID`
- `DELETE /crimes/:ROWID`
- `POST /crimes/upload-csv`
- `GET /crimes/filter`

### dashboard-api

- `GET /dashboard/global-stats`
- `GET /dashboard/summary`
- `GET /dashboard/monthly-trends`
- `GET /dashboard/yearly-trends`
- `GET /dashboard/crime-types`
- `GET /dashboard/district-ranking`
- `GET /dashboard/police-station-ranking`
- `GET /dashboard/crime-group-ranking`
- `GET /dashboard/crime-head-ranking`
- `GET /dashboard/fir-stage-summary`
- `GET /dashboard/complaint-mode-summary`
- `GET /dashboard/recent-records`
- `GET /dashboard/filters`

Additional Catalyst Functions include `risk-api`, `alert-api`, `map-api`, `time-machine-api`, `forecast-api`, `socio-economic-api`, `pattern-api`, `report-api`, and `ai-api`.

## Deploy

From the project root:

```bash
catalyst deploy
```

After deployment:

- Add the deployed web client URL to Catalyst Authentication allowed redirect URLs
- Verify Data Store table permissions
- Configure `GEMINI_API_KEY` in Catalyst Function environment variables
- Upload a small CSV sample
- Open `/presentation-mode` for the hackathon demo journey

## Future Scope

- Role-based access for command, district, and station-level officers
- Scheduled alert generation
- Case workflow integration
- Karnataka boundary choropleth overlays
- Real-time alert notifications
- Model-assisted investigation summaries
- Evidence and charge-sheet tracking integrations
- Production-only Catalyst Auth without demo fallback
