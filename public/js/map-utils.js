(function () {
  'use strict';

  const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
  const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
  const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

  async function readJson(url) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  }

  function normalizeQuery(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildGeocodeCandidates(rawQuery) {
    const original = String(rawQuery || '').trim();
    const normalized = normalizeQuery(original);
    const withoutNumberSign = normalized.replace(/#/g, ' ');
    const noPunctuation = withoutNumberSign.replace(/[.,;:]/g, ' ');
    const withCityHint = `${noPunctuation} La Paz Bolivia`.replace(/\s+/g, ' ').trim();
    const withCountryHint = `${noPunctuation} Bolivia`.replace(/\s+/g, ' ').trim();

    const unique = [original, normalized, noPunctuation, withCityHint, withCountryHint]
      .map(item => item.trim())
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);

    return unique;
  }

  // Construye una dirección corta y legible a partir de los componentes de
  // Nominatim, evitando el display_name larguísimo que confunde al conductor.
  function shortAddress(addr, displayName) {
    if (addr) {
      const calle  = [addr.road, addr.pedestrian, addr.house_number].filter(Boolean).join(' ').trim();
      const zona   = addr.neighbourhood || addr.suburb || addr.quarter || addr.residential || addr.city_district || addr.village || addr.hamlet;
      const ciudad = addr.city || addr.town || addr.municipality || addr.county;
      const parts = [calle, zona, ciudad].filter(Boolean);
      if (parts.length) return parts.slice(0, 3).join(', ');
    }
    if (displayName) {
      return String(displayName).split(',').slice(0, 2).map(s => s.trim()).filter(Boolean).join(', ');
    }
    return '';
  }

  async function geocodeAddress(query, options = {}) {
    const q = String(query || '').trim();
    if (!q) throw new Error('Direccion vacia');
    const countryCode = options.countryCode || 'bo';
    const candidates = buildGeocodeCandidates(q);
    let firstError = null;

    for (const candidate of candidates) {
      try {
        const url = `${SEARCH_URL}?format=jsonv2&limit=1&addressdetails=1&accept-language=es&countrycodes=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(candidate)}`;
        const data = await readJson(url);
        if (!Array.isArray(data) || data.length === 0) continue;
        return {
          lat: Number(data[0].lat),
          lng: Number(data[0].lon),
          label: shortAddress(data[0].address, data[0].display_name) || candidate,
          fullLabel: data[0].display_name || candidate,
        };
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }

    if (firstError) throw firstError;
    throw new Error('Direccion no encontrada');
  }

  async function reverseGeocode(lat, lng) {
    const url = `${REVERSE_URL}?format=jsonv2&addressdetails=1&accept-language=es&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const data = await readJson(url);
    const corta = shortAddress(data.address, data.display_name);
    return {
      lat: Number(data.lat || lat),
      lng: Number(data.lon || lng),
      label: corta || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      fullLabel: data.display_name || '',
    };
  }

  async function fetchRoute(origin, destination) {
    const start = `${origin.lng},${origin.lat}`;
    const end = `${destination.lng},${destination.lat}`;
    const url = `${ROUTE_URL}/${start};${end}?overview=full&geometries=geojson&steps=true&annotations=distance,duration`;
    const data = await readJson(url);

    if (!data.routes || !data.routes.length) {
      throw new Error('Ruta no disponible');
    }

    const route = data.routes[0];
    return {
      distanceMeters: Number(route.distance || 0),
      durationSeconds: Number(route.duration || 0),
      coordinates: route.geometry?.coordinates || [],
      steps: route.legs?.[0]?.steps || [],
    };
  }

  function formatDistance(distanceMeters) {
    const meters = Number(distanceMeters || 0);
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }

  function formatDuration(durationSeconds) {
    const seconds = Math.max(0, Math.round(Number(durationSeconds || 0)));
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }

  function haversineMeters(a, b) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const aa = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  }

  window.EstAirbnbMapUtils = {
    geocodeAddress,
    reverseGeocode,
    fetchRoute,
    formatDistance,
    formatDuration,
    haversineMeters,
  };
})();
