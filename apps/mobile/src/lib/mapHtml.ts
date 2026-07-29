export interface MapMarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  imageUrl: string | null;
  collected: boolean;
}

// Leaflet + Leaflet.markercluster loaded from CDN so the same HTML document
// renders identically in a browser tab (web) and inside a WebView (native).
export function buildMapHtml(markers: MapMarkerData[]): string {
  const markersJson = JSON.stringify(markers);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  .poke-lid-pin {
    width: 34px; height: 34px; border-radius: 50%; background: #fff;
    border-width: 3px; border-style: solid; box-shadow: 0 1px 4px rgba(0,0,0,0.45);
    overflow: hidden; display: flex; align-items: center; justify-content: center;
  }
  .poke-lid-pin img { width: 100%; height: 100%; object-fit: cover; }
  .poke-lid-pin-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 2px rgba(0,0,0,0.5); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
  var markers = ${markersJson};
  var map = L.map('map').setView([36.5, 138.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  function pinIcon(m) {
    var color = m.collected ? '#2e8b57' : '#999';
    if (m.imageUrl) {
      return L.divIcon({
        className: '',
        html:
          '<div class="poke-lid-pin" style="border-color:' + color + ';">' +
          '<img src="' + m.imageUrl + '" /></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });
    }
    return L.divIcon({
      className: '',
      html: '<div class="poke-lid-pin-dot" style="background:' + color + ';"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  function notifySelect(id) {
    var payload = JSON.stringify({ type: 'select', id: id });
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(payload);
    } else if (window.parent) {
      window.parent.postMessage(payload, '*');
    }
  }

  var cluster = L.markerClusterGroup();
  markers.forEach(function (m) {
    var marker = L.marker([m.lat, m.lng], { icon: pinIcon(m) });
    marker.bindPopup(m.name);
    marker.on('click', function () {
      notifySelect(m.id);
    });
    cluster.addLayer(marker);
  });
  map.addLayer(cluster);
</script>
</body>
</html>`;
}
