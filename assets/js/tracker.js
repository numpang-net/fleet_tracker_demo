// js/tracker.js

// Bootstrap configuration loop maps
function initializeRouteSelector() {
    if (window.routesPathsData && window.routesPathsData.features) {
        const selector = document.getElementById('route-selector');
        if (!selector) return;
        
        window.routesPathsData.features.forEach(f => {
            if (f.properties && f.properties.routeCode) {
                window.routeNamesLookup[f.properties.routeCode.toLowerCase()] = f.properties.routeName || "Operational Route";
            }
        });

        if (window.routeStopsIndex) {
            Object.keys(window.routeStopsIndex).forEach(routeKey => {
                const upperRoute = routeKey.toUpperCase();
                const stopIdsArray = window.routeStopsIndex[routeKey] || [];
                stopIdsArray.forEach(stopId => {
                    if (!window.stopRoutesIndex[stopId]) window.stopRoutesIndex[stopId] = [];
                    if (!window.stopRoutesIndex[stopId].includes(upperRoute)) window.stopRoutesIndex[stopId].push(upperRoute);
                });
            });
        }

        const trackingCodes = window.routesPathsData.features.map(f => f.properties.routeCode ? f.properties.routeCode.toLowerCase() : '').filter(Boolean);
        [...new Set(trackingCodes)].sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = getDisplayRouteCode(code);
            selector.appendChild(opt);
        });
    }
}

function updateRouteDescriptionLabel(selectedRoute, isInitialBoot = false) {
    const label = document.getElementById('route-description-text');
    if (!label) return;

    if (selectedRoute === 'all') {
        if (isInitialBoot) {
            label.classList.add('route-prompt-text');
            label.innerHTML = window.txtPrompt;
            label.style.display = 'inline-block';
            label.style.opacity = '1';
            return;
        }
        label.style.opacity = '0';
        setTimeout(() => {
            const currentSelector = document.getElementById('route-selector');
            if (currentSelector && currentSelector.value === 'all') {
                label.classList.add('route-prompt-text');
                label.innerHTML = window.txtPrompt;
                label.style.display = 'inline-block';
                void label.offsetWidth; label.style.opacity = '1';
            }
        }, 200);
    } else {
        const descriptiveName = window.routeNamesLookup[selectedRoute.toLowerCase()] || '';
        if (descriptiveName) {
            label.classList.remove('route-prompt-text');
            label.textContent = `${descriptiveName}`;
            label.style.display = 'inline-block';
            void label.offsetWidth; label.style.opacity = '1';
        } else {
            label.style.display = 'none';
        }
    }
}

function updateTimetableLink(selectedRoute) {
    const container = document.getElementById('timetable-link-container'), anchor = document.getElementById('route-timetable-link'), linkText = document.getElementById('timetable-link-text');
    if (!container || !anchor || !linkText) return;

    const activeLink = window.timetableMap[selectedRoute.trim().toLowerCase()];
    if (selectedRoute === 'all' || !activeLink) {
        container.style.display = 'none';
    } else {
        anchor.href = activeLink;
        linkText.textContent = window.txtTimetable.replace('%ROUTE%', getDisplayRouteCode(selectedRoute));
        container.style.display = 'inline-flex';
    }
}

window.activeVehicleId = null;

window.clearActiveVehicleCard = function() {
    document.querySelectorAll('.vehicle-card.is-active').forEach(card => {
        card.classList.remove('is-active');
    });
    window.activeVehicleId = null;
};

window.renderVehicleSidebar = function(buses) {
    const list = document.getElementById('vehicle-list');
    const empty = document.getElementById('vehicle-sidebar-empty');
    if (!list || !empty) return;

    list.replaceChildren();
    empty.style.display = buses.length ? 'none' : 'block';

    buses.forEach((bus, index) => {
        const vehicleId = String(bus.vehicleNumber || bus.id || 'Unknown');
        const card = document.createElement('article');
        card.className = 'vehicle-card';

        const link = document.createElement('button');
        link.className = 'vehicle-id-link';
        link.type = 'button';
        link.textContent = vehicleId;
        link.setAttribute('aria-pressed', String(window.activeVehicleId === vehicleId));
        link.setAttribute('aria-label', window.txtShowVehicleOnMap.replace('%ID%', vehicleId));
        link.addEventListener('click', () => {
            const marker = window.vehicleMarkers?.[vehicleId];
            if (marker) {
                document.querySelectorAll('.vehicle-card.is-active').forEach(activeCard => {
                    activeCard.classList.remove('is-active');
                });
                card.classList.add('is-active');
                document.querySelectorAll('.vehicle-id-link[aria-pressed="true"]').forEach(activeLink => {
                    activeLink.setAttribute('aria-pressed', 'false');
                });
                link.setAttribute('aria-pressed', 'true');
                window.activeVehicleId = vehicleId;
                window.map.once('moveend', () => marker.openPopup());
                window.map.setView(marker.getLatLng(), Math.max(window.map.getZoom(), 14), { animate: true });
            }
        });

        const route = document.createElement('span');
        route.className = 'vehicle-route-label';
        route.textContent = getDisplayRouteCode(bus.routeCode || 'bus');

        const details = document.createElement('dl');
        const serviceStatus = index % 3 === 0 ? window.txtStatusDue : window.txtStatusOk;
        const routeStatus = index % 4 === 0 ? window.txtStatusLate : window.txtStatusOnTime;
        const values = [
            [window.txtServiceStatus, serviceStatus],
            [window.txtLastServiceDate, `2026-${String((index % 8) + 1).padStart(2, '0')}-${String((index % 24) + 1).padStart(2, '0')}`],
            [window.txtPassengerCount, `${(index + 1) * 7}/50`],
            [window.txtRouteStatus, routeStatus],
            [window.txtFuelStatus, `${82 - (index * 9 % 34)}%`]
        ];

        values.forEach(([label, value]) => {
            const term = document.createElement('dt');
            term.textContent = label;
            const description = document.createElement('dd');
            description.textContent = value;
            if ((label === window.txtServiceStatus && value === window.txtStatusDue) || (label === window.txtRouteStatus && value === window.txtStatusLate)) {
                description.className = 'vehicle-status-warning';
            }
            details.append(term, description);
        });

        const heading = document.createElement('div');
        heading.className = 'vehicle-card-heading';
        heading.append(link, route);
        card.append(heading, details);
        if (window.activeVehicleId === vehicleId) card.classList.add('is-active');
        list.append(card);
    });
};

// --- GLOBAL SYSTEM DELEGATED LISTENERS REGISTRY ---
document.getElementById('route-selector')?.addEventListener('change', (e) => {
    const code = e.target.value;
    window.clearActiveVehicleCard();
    updateRouteDescriptionLabel(code); updateTimetableLink(code); renderSelectedRouteLine(code); renderFilteredBusStops(code); syncLiveBusTracker();
});

document.querySelectorAll('input[name="feed-source"]')?.forEach(radio => {
    radio.addEventListener('change', () => syncLiveBusTracker());
});

// Info Modal Triggers
const infoOverlay = document.getElementById('info-modal-overlay'), infoTrigger = document.getElementById('info-modal-trigger'), infoClose = document.getElementById('info-modal-close');
if (infoTrigger) infoTrigger.addEventListener('click', () => { if (infoOverlay) infoOverlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; });
if (infoClose) infoClose.addEventListener('click', () => { if (infoOverlay) infoOverlay.style.display = 'none'; document.body.style.overflow = ''; });
if (infoOverlay) infoOverlay.addEventListener('click', (e) => { if (e.target === infoOverlay) { infoOverlay.style.display = 'none'; document.body.style.overflow = ''; } });

// --- BOOTSTRAP INITIALIZATION ENGINE ---
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('vehicle-sidebar');
    const sidebarToggle = document.getElementById('vehicle-sidebar-toggle');
    sidebarToggle?.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('is-collapsed');
        sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
        sidebarToggle.setAttribute('aria-label', isCollapsed ? window.txtExpandVehicleSidebar : window.txtCollapseVehicleSidebar);
        sidebarToggle.querySelector('span').textContent = isCollapsed ? '+' : '−';
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#location-toggle-btn');
        if (!btn) return;
        btn.getAttribute('data-tracking-state') === 'off' ? startUserLocationTracking() : stopUserLocationTracking();
    });

    window.map.on('dragstart', () => {
        const btn = document.getElementById('location-toggle-btn');
        if (btn && btn.getAttribute('data-tracking-state') === 'locked') btn.setAttribute('data-tracking-state', 'seeking');
    });

    window.map.on('fullscreenchange', () => window.map.invalidateSize({ animate: true }));
    window.map.on('popupclose', (e) => {
        if (e.popup._source?.options?.pane === 'busStopsPane') window.currentlyOpenStopId = null;
    });

    let timetableMapInstance = null;
    const timetableLink = document.getElementById('route-timetable-link');

    if (timetableLink) {
        timetableLink.addEventListener('click', function(e) {
            e.preventDefault();
            const imageUrl = this.getAttribute('href'), modalOverlay = document.getElementById('timetable-modal-overlay');
            document.getElementById('timetable-modal-title').innerText = document.getElementById('route-description-text').innerText || "Transit Map";
            modalOverlay.style.display = 'block';

            const img = new Image();
            img.src = imageUrl;
            img.onload = function() {
                if (timetableMapInstance) timetableMapInstance.remove();
                timetableMapInstance = L.map('timetable-image-viewer', { center: [0, 0], zoom: 0, crs: L.CRS.Simple, zoomControl: true, attributionControl: false });
                const bounds = new L.LatLngBounds(timetableMapInstance.unproject([0, this.height], 2), timetableMapInstance.unproject([this.width, 0], 2));
                L.imageOverlay(imageUrl, bounds).addTo(timetableMapInstance);
                timetableMapInstance.setMaxBounds(bounds); timetableMapInstance.fitBounds(bounds, {animate: false});
            };
        });
    }

    document.getElementById('timetable-modal-close')?.addEventListener('click', () => {
        document.getElementById('timetable-modal-overlay').style.display = 'none';
        if (timetableMapInstance) { timetableMapInstance.remove(); timetableMapInstance = null; }
    });

    document.getElementById('timetable-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'timetable-modal-overlay') {
            document.getElementById('timetable-modal-overlay').style.display = 'none';
            if (timetableMapInstance) { timetableMapInstance.remove(); timetableMapInstance = null; }
        }
    });

    window.injectDynamicCopyrightYear();
    initializeRouteSelector();
    renderFilteredBusStops('all');
    updateRouteDescriptionLabel('all', true);
    syncLiveBusTracker();
    
    setInterval(syncLiveBusTracker, 30000);
});
