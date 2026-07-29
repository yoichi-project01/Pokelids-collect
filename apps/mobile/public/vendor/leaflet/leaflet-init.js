(function () {
  var dataEl = document.getElementById('map-data');
  var data = JSON.parse(dataEl.textContent);
  var markers = data.markers;
  var currentLocation = data.currentLocation;

  var map = L.map('map').setView([36.5, 138.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  function pinIcon(m) {
    var color = m.collected ? '#0F766E' : '#999';
    if (m.imageUrl) {
      return L.divIcon({
        className: '',
        html: '<div class="poke-lid-pin" style="border-color:' + color + ';">' + '<img src="' + m.imageUrl + '" /></div>',
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

  if (currentLocation) {
    var currentLocationIcon = L.divIcon({
      className: '',
      html: '<div class="current-location-dot"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker([currentLocation.lat, currentLocation.lng], {
      icon: currentLocationIcon,
      zIndexOffset: 1000,
      interactive: false,
    })
      .bindPopup('現在地')
      .addTo(map);
  }
})();
