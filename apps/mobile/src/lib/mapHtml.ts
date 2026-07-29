export interface MapMarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  imageUrl: string | null;
  collected: boolean;
}

// Leaflet + Leaflet.markercluster (and the map init logic itself) are
// self-hosted under public/vendor/leaflet rather than loaded from unpkg or
// embedded inline:
// - Self-hosting lets the service worker's same-origin caching actually
//   cache them for offline use (a CDN origin is never covered by that cache).
// - Externalizing the init script (instead of an inline <script> block) is
//   required by helmet's default CSP (script-src 'self', no 'unsafe-inline')
//   — that CSP applies inside this iframe's srcDoc too, since srcDoc content
//   with no CSP of its own inherits the embedding page's policy. Marker/
//   location data is passed via a `type="application/json"` element instead,
//   which isn't "script" as far as CSP is concerned.
// `assetBaseUrl` is the API/web origin (empty string on web = relative to
// the current page; an absolute URL on native, where there's no "current
// origin" for a WebView-rendered HTML string).
export function buildMapHtml(
  markers: MapMarkerData[],
  assetBaseUrl: string,
  currentLocation: { lat: number; lng: number } | null,
): string {
  const asset = (path: string) => `${assetBaseUrl}/vendor/leaflet/${path}`;
  const mapDataJson = JSON.stringify({ markers, currentLocation }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${asset('leaflet.css')}" />
<link rel="stylesheet" href="${asset('MarkerCluster.css')}" />
<link rel="stylesheet" href="${asset('MarkerCluster.Default.css')}" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  .poke-lid-pin {
    width: 34px; height: 34px; border-radius: 50%; background: #fff;
    border-width: 3px; border-style: solid; box-shadow: 0 1px 4px rgba(0,0,0,0.45);
    overflow: hidden; display: flex; align-items: center; justify-content: center;
  }
  .poke-lid-pin img { width: 100%; height: 100%; object-fit: cover; }
  .poke-lid-pin-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 2px rgba(0,0,0,0.5); }
  .current-location-dot {
    width: 16px; height: 16px; border-radius: 50%; background: #1a73e8;
    border: 3px solid #fff; box-shadow: 0 0 0 2px rgba(26,115,232,0.4), 0 1px 4px rgba(0,0,0,0.4);
  }
</style>
</head>
<body>
<div id="map"></div>
<script type="application/json" id="map-data">${mapDataJson}</script>
<script src="${asset('leaflet.js')}"></script>
<script src="${asset('leaflet.markercluster.js')}"></script>
<script src="${asset('leaflet-init.js')}"></script>
</body>
</html>`;
}
