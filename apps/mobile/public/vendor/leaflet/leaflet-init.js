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

  // Popup content is built from server-sourced text (municipality/pokemon
  // names) and inserted as innerHTML by Leaflet's bindPopup — escaped
  // defensively even though the source is a vetted official-site scrape.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 6-1's "写真を撮って記録" quick-record button only ever appears here
  // (m.canQuickRecord, computed TS-side against QUICK_RECORD_RADIUS_METERS —
  // see MapMarkerData's doc comment) — "詳細を見る" is always present so the
  // pin -> detail-screen path keeps working even with location denied.
  function popupHtml(m) {
    var html = '<div class="poke-lid-popup">';
    html += '<div class="poke-lid-popup-name">' + escapeHtml(m.name) + '</div>';
    html += '<div class="poke-lid-popup-actions">';
    if (m.canQuickRecord) {
      html +=
        '<button type="button" class="poke-lid-popup-btn poke-lid-popup-btn-primary" data-action="record">写真を撮って記録</button>';
    }
    html += '<button type="button" class="poke-lid-popup-btn" data-action="detail">詳細を見る</button>';
    html += '</div></div>';
    return html;
  }

  function notify(type, id) {
    var payload = JSON.stringify({ type: type, id: id });
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(payload);
    } else if (window.parent) {
      window.parent.postMessage(payload, '*');
    }
  }

  // Keyed by id so the reverse channel below (host -> map) can flip a single
  // pin to "collected" in place after a successful quick record, without
  // rebuilding the whole page — regenerating from a fresh buildMapHtml() call
  // would reset the user's pan/zoom right at the moment they most want the
  // map to hold still (6-6).
  var markersById = {};

  var cluster = L.markerClusterGroup();
  markers.forEach(function (m) {
    var marker = L.marker([m.lat, m.lng], { icon: pinIcon(m) });
    marker.bindPopup(popupHtml(m), { minWidth: 180 });
    // Tapping the pin only opens the popup (Leaflet's own bindPopup
    // behavior) — the two actions inside the popup are what actually notify
    // the host, wired below on 'popupopen' since the buttons don't exist in
    // the DOM until Leaflet renders the popup content.
    marker.on('popupopen', function (e) {
      var container = e.popup.getElement();
      if (!container) return;
      var recordBtn = container.querySelector('[data-action="record"]');
      if (recordBtn) {
        L.DomEvent.on(recordBtn, 'click', function (evt) {
          L.DomEvent.stop(evt);
          notify('quickRecord', m.id);
        });
      }
      var detailBtn = container.querySelector('[data-action="detail"]');
      if (detailBtn) {
        L.DomEvent.on(detailBtn, 'click', function (evt) {
          L.DomEvent.stop(evt);
          notify('select', m.id);
        });
      }
    });
    cluster.addLayer(marker);
    markersById[m.id] = { marker: marker, data: m };
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

  // Host -> map messages (6-6's reverse channel — nothing wrote to this
  // before). Listened on both `window` (web iframe, and iOS WebView) and
  // `document` (Android WebView) — react-native-webview only delivers
  // postMessage there on Android.
  function handleHostMessage(event) {
    var msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    if (!msg || msg.type !== 'markCollected' || !msg.id) return;
    var entry = markersById[msg.id];
    if (!entry) return;
    entry.data.collected = true;
    entry.marker.setIcon(pinIcon(entry.data));
    entry.marker.closePopup();
  }
  window.addEventListener('message', handleHostMessage);
  document.addEventListener('message', handleHostMessage);
})();
