import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function RouteMap({ route, startLabel, endLabel }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstance.current) {
      mapInstance.current.remove()
      mapInstance.current = null
    }

    const points = (route || []).filter(s => s.latitude && s.longitude && s.status !== 'completed' && s.status !== 'skipped')
    if (points.length < 1) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    })
    mapInstance.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const latLngs = points.map(p => [p.latitude, p.longitude])

    // Draw route line
    L.polyline(latLngs, { color: '#2563EB', weight: 3, opacity: 0.7 }).addTo(map)

    // Add numbered markers for each stop
    points.forEach((p, i) => {
      const isFirst = i === 0
      const isLast = i === points.length - 1

      const icon = L.divIcon({
        className: 'route-marker',
        html: `<div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${isFirst ? '#2563EB' : '#3B82F6'};
          color: white; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">${i + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([p.latitude, p.longitude], { icon }).addTo(map)

      const vendors = p.vendors?.join(', ') || ''
      const tooltip = `${p.retailer_name} #${p.store_number}${vendors ? '\n' + vendors : ''}${p.earnings ? '\n$' + p.earnings : ''}`
      marker.bindPopup(`<div style="font-size:12px;line-height:1.4;">
        <b>${p.retailer_name} #${p.store_number}</b><br/>
        ${p.city || ''}${p.city && p.state ? ', ' : ''}${p.state || ''}<br/>
        ${vendors ? vendors + '<br/>' : ''}
        ${p.drive_time_min ? Math.round(p.drive_time_min) + ' min drive &bull; ' : ''}${p.drive_distance_mi ? p.drive_distance_mi + ' mi' : ''}
        ${p.earnings ? '<br/><b>$' + p.earnings + '</b>' : ''}
      </div>`)
    })

    // Fit map to show all markers with padding
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12)
    } else {
      map.fitBounds(latLngs, { padding: [30, 30] })
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [route])

  return <div ref={mapRef} className="w-full h-56 rounded-xl border border-gray-200 bg-gray-100" />
}

export default RouteMap
