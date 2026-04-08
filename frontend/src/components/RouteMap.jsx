import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function RouteMap({ route }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstance.current) {
      mapInstance.current.remove()
      mapInstance.current = null
    }

    const points = (route || []).filter(s => s.latitude && s.longitude && s.status !== 'completed' && s.status !== 'skipped' && s.status !== 'removed')
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

    // Add numbered markers for each stop
    points.forEach((p, i) => {
      const icon = L.divIcon({
        className: 'route-marker',
        html: `<div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${i === 0 ? '#2563EB' : '#3B82F6'};
          color: white; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">${i + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([p.latitude, p.longitude], { icon }).addTo(map)

      const vendors = p.vendors?.join(', ') || ''
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

    // Fetch actual road routes from OSRM (free) and draw them
    if (points.length >= 2) {
      const coords = points.map(p => `${p.longitude},${p.latitude}`).join(';')
      fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
        .then(r => r.json())
        .then(data => {
          if (data.code === 'Ok' && data.routes?.[0]?.geometry) {
            const routeLine = L.geoJSON(data.routes[0].geometry, {
              style: { color: '#2563EB', weight: 4, opacity: 0.7 },
            })
            if (mapInstance.current) {
              routeLine.addTo(mapInstance.current)
            }
          }
        })
        .catch(() => {
          // Fallback to straight lines if OSRM fails
          if (mapInstance.current) {
            L.polyline(latLngs, { color: '#2563EB', weight: 3, opacity: 0.5, dashArray: '8,8' }).addTo(mapInstance.current)
          }
        })
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
