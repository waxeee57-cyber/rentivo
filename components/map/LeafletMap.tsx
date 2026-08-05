import React, { useMemo, useRef, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { useThemeStore } from '@/lib/store/useThemeStore'

// Leaflet + OpenStreetMap/CARTO map in a WebView — zero API keys, zero cost.
// Replaces the react-native-maps path when no Google Maps key is configured.
// Markers are Airbnb-style price pills; tapping one posts the listing id
// back to React Native.

export interface LeafletPin {
  id: string
  lat: number
  lng: number
  label: string       // e.g. "€500"
  selected?: boolean
}

interface Props {
  pins: LeafletPin[]
  centerLat?: number
  centerLng?: number
  zoom?: number
  onPinPress?: (id: string) => void
  showsUserLocation?: boolean
}

function buildHtml(pins: LeafletPin[], centerLat: number, centerLng: number, zoom: number, isDark: boolean): string {
  const tiles = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
  const pinBg = isDark ? '#141D2E' : '#FFFFFF'
  const pinInk = isDark ? '#F2F0EB' : '#1A1F2B'
  // Selected pin = ink fill (ink-first: accent reserved for CTAs)
  const pinSel = isDark ? '#F2F0EB' : '#0A1628'
  const pinSelInk = isDark ? '#0A1220' : '#FFFFFF'
  const pinsJson = JSON.stringify(pins)
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${isDark ? '#0A1220' : '#FAF9F7'}}
  .price-pin{background:${pinBg};color:${pinInk};border:1px solid rgba(0,0,0,0.12);
    border-radius:999px;padding:4px 10px;font:600 12px -apple-system,Roboto,sans-serif;
    box-shadow:0 2px 8px rgba(10,22,40,0.25);white-space:nowrap;transform:translate(-50%,-50%);
    display:inline-block}
  .price-pin.sel{background:${pinSel};color:${pinSelInk};border-color:${pinSel}}
  .leaflet-control-attribution{font-size:9px;opacity:0.7}
</style></head><body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([${centerLat}, ${centerLng}], ${zoom});
  L.tileLayer('${tiles}', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  var pins = ${pinsJson};
  pins.forEach(function(p) {
    var icon = L.divIcon({
      className: '',
      html: '<div class="price-pin' + (p.selected ? ' sel' : '') + '">' + p.label + '</div>',
      iconSize: null
    });
    L.marker([p.lat, p.lng], { icon: icon }).addTo(map).on('click', function() {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(p.id);
    });
  });
  if (pins.length > 1) {
    var b = L.latLngBounds(pins.map(function(p){ return [p.lat, p.lng] }));
    map.fitBounds(b, { padding: [48, 48], maxZoom: 15 });
  }
</script></body></html>`
}

export function LeafletMap({ pins, centerLat = 36.51, centerLng = -4.88, zoom = 12, onPinPress }: Props) {
  const isDark = useThemeStore(s => s.isDark)
  const webRef = useRef<WebView>(null)

  const html = useMemo(
    () => buildHtml(pins, centerLat, centerLng, zoom, isDark),
    // Rebuild when the pin set or selection changes (cheap: WebView reload of a tiny doc)
    [JSON.stringify(pins), centerLat, centerLng, zoom, isDark], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    // no-op: html regeneration drives updates
  }, [html])

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        onMessage={e => onPinPress?.(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
})

export default LeafletMap
