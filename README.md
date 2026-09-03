# BAS.MY Kuching Fleet Tracker

A responsive, real-time bus tracking application for BAS.MY routes in Kuching, Sarawak. The site uses Hugo for static generation, vanilla JavaScript for the browser application, Leaflet for mapping, and Cloudflare Pages Functions for the live vehicle API.

## Features

- Live vehicle positions from a GTFS-Realtime protobuf feed.
- Development simulation feed using the bundled dummy vehicle payload.
- Route selector with route descriptions, route geometry, stops, and timetable links.
- Leaflet map with route lines, bus markers, stop markers, interchanges, terminals, and geolocation.
- Map routes are enriched through OSRM when available and fall back to the original GTFS shape.
- Responsive map height based on the available viewport on desktop and mobile.
- Floating top navigation bar containing the app header, project information, and language switcher.
- Map legend that starts collapsed as an `i` box and expands in place.
- Fleet overview panel that starts collapsed, floats over the bottom of the map, and works in fullscreen mode.
- Fleet overview cards with service status, last service date, passenger count, route status, and fuel status.
- Vehicle IDs in the fleet overview focus the map, zoom to the vehicle, and open its map popup.
- Selected vehicle cards receive a highlight that moves between vehicles and clears when the popup closes or the route resets.
- Vehicle sidebar content scrolls independently from the map on desktop and mobile.
- English, Bahasa Melayu, and Simplified Chinese interfaces.
- Scheduled stop times shown in stop popups.
- Timetable image viewer with Leaflet zoom and pan controls.
- Edge caching for live vehicle responses.

The service and vehicle values in the fleet overview are currently dummy demonstration parameters. Vehicle locations, route codes, destinations, and vehicle IDs come from the configured feed or test data.

## Architecture

```text
GTFS Static files                  GTFS-Realtime feed
        |                                  |
        v                                  v
Validation and parsers              Cloudflare Pages Function
        |                                  |
        v                                  v
Hugo JSON assets  ---------------->  /api/buses response
        |                                  |
        +--------------> Leaflet frontend
                           |       |
                           |       +--> Vehicle markers and popups
                           +----------> Routes, stops, schedules, GPS
```

### Static data pipeline

The pipeline starts with `routes.txt`, `trips.txt`, `shapes.txt`, `stops.txt`, and `stop_times.txt`. [validate-gtfs.js](.devcontainer/scripts/validate-gtfs.js) selects the remote feed or a verified fallback archive, checks the extracted files, and prepares `tmp-gtfs/`.

The parser scripts then generate:

| Output | Purpose |
| --- | --- |
| `assets/data/routes_paths.json` | GeoJSON route shapes used by the map |
| `assets/data/stops_locations.json` | GeoJSON stop locations and names |
| `assets/data/route_stops_index.json` | Route-to-stop lookup |
| `assets/data/destinations.json` | Route and direction terminal lookup |
| `assets/data/stop_times.json` | Compiled scheduled arrival times |
| `assets/data/trip_prefix_routes.json` | Trip-prefix route relationships |
| `static/data/trip_lookup.json` | Backend trip-to-route metadata lookup |

The orchestration entry point is [.devcontainer/setup.sh](.devcontainer/setup.sh). It runs validation and all parsers, then removes the temporary GTFS directory.

### Browser application

The Hugo template [layouts/index.html](layouts/index.html) embeds the generated JSON data and concatenates the browser modules into a fingerprinted bundle.

- [config.js](assets/js/config.js): branch configuration, localization values, and shared state.
- [utils.js](assets/js/utils.js): route display suffixes, distance calculations, and utility functions.
- [map_utils.js](assets/js/map_utils.js): Leaflet initialization, map controls, legend, routes, stops, and scroll handling.
- [gps_utils.js](assets/js/gps_utils.js): browser geolocation tracking and accuracy display.
- [api.js](assets/js/api.js): vehicle feed polling, filtering, markers, popups, and fleet sidebar refresh.
- [tracker.js](assets/js/tracker.js): application startup, route selection, sidebar state, modals, and refresh scheduling.

The frontend polls `/api/buses` every 30 seconds. On non-production branches, users can choose between the live feed and the simulation feed. The `main` branch hides that development feed selector.

### Runtime API

[functions/api/buses.js](functions/api/buses.js) handles `GET /api/buses`:

1. `?mock=true` returns the bundled simulation payload.
2. Live requests fetch `REALTIME_API_URL` and decode the protobuf feed with `gtfs-realtime-bindings`.
3. Trip IDs are joined with `/data/trip_lookup.json` to resolve route metadata.
4. Live responses are cached for 30 seconds and returned as a compact JSON array.

## Local development

The recommended environment is the included VS Code Dev Container. It provides Node.js, Hugo Extended, Wrangler, Cypress dependencies, and the system packages needed for headless browser tests.

Required environment variables are supplied through `.env`:

```bash
STATIC_GTFS_URL="https://example.invalid/static-feed.zip"
REALTIME_API_URL="https://example.invalid/realtime-feed.pb"
```

Do not commit real secrets or private endpoints. The fallback archives in `assets/fallback/` allow the static pipeline to work when the remote static feed is unavailable.

### Full local workflow

Set the branch and static-feed mode in [run_config.yml](run_config.yml):

```yaml
development:
  branch: "dev"
  gtfs-status: "normal"
```

Then run:

```bash
chmod +x *.sh
./run_local_full.sh
```

This clears generated data, rebuilds the GTFS assets, runs lint and unit tests, builds the Hugo site, and starts Wrangler at <http://localhost:8788>.

### Individual commands

```bash
./init_data.sh                         # Rebuild GTFS-derived assets
./run_local.sh                         # Lint, test, build, and serve
npm start                              # Serve existing public/ with Wrangler
hugo --minify                          # Build the static site
npm run lint                           # Run ESLint
npm run test:unit -- --run             # Run Vitest once
npm run test:unit:watch                # Run Vitest in watch mode
npx cypress run --headless             # Run Cypress against localhost:8788
npx cypress run --spec cypress/e2e/tracker.cy.js
```

`npm start` and Cypress expect a built `public/` directory and a local server on port `8788`. `run_local.sh` performs the complete build before starting Wrangler.

## Testing

Unit tests live under [test](test/) and cover the frontend modules and GTFS parser logic. Cypress tests live under [cypress/e2e](cypress/e2e/):

- `tracker.cy.js`: map, routes, stops, popups, schedules, and destination behavior.
- `tracker-lang.cy.js`: language pages and language-switch navigation.
- `tracker-fallback.cy.js`: fallback GTFS data and fallback map boot behavior.

Run the unit suite with:

```bash
npm run test:unit -- --run
```

Run Cypress after starting the local server with:

```bash
npx cypress run --headless
```

## Localization

Translations are stored in:

- [i18n/en.yaml](i18n/en.yaml)
- [i18n/ms.yaml](i18n/ms.yaml)
- [i18n/zh.yaml](i18n/zh.yaml)

Hugo places translated strings in `data-*` attributes on `#app-shell`. The browser modules read those values through [config.js](assets/js/config.js), so runtime-generated vehicle cards and map controls use the active language too.

## Deployment

The GitHub Actions workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs on pushes to `main` and `dev`, and on the scheduled daily sync. It:

1. Installs dependencies.
2. Runs lint and unit tests.
3. Downloads and validates the static GTFS feed.
4. Builds the Hugo site.
5. Runs the Cypress suite against Wrangler.
6. Deploys the generated `public/` directory to Cloudflare Pages.

Configure these repository or Cloudflare values before deployment:

- `STATIC_GTFS_URL`
- `REALTIME_API_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Production uses the `main` branch and live data. Preview or development deployments retain the simulation feed controls.

## Repository map

```text
assets/css/                 Tracker stylesheet
assets/data/                Generated Hugo data assets
assets/js/                  Browser application modules
assets/fallback/            Verified GTFS fallback archives
functions/api/              Cloudflare Pages Functions
i18n/                       Hugo translations
layouts/                    Hugo templates
static/data/                Backend-served generated lookup data
.devcontainer/scripts/      GTFS validation and parser scripts
cypress/e2e/                End-to-end browser tests
test/                       Vitest unit tests
run_config.yml              Local branch and GTFS mode
run_local.sh                Build and serve workflow
run_local_full.sh           Clean rebuild and serve workflow
```

## Credits

- BAS.MY Kuching and Bas Asia for transit data and support.
- Leaflet and the OpenStreetMap community for mapping tools and data.
- Hugo and Cloudflare Pages for the site and deployment infrastructure.
- Community contributors and testers who support the tracker.
