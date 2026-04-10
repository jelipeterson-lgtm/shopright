import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function RouteMap({ route, startCoords, endAddress }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstance.current) {
      mapInstance.current.remove()
      mapInstance.current = null
    }

    const points = (route || []).filter(s => s.latitude && s.longitude && s.status === 'upcoming')
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

    const allLatLngs = []

    // Add start marker if we have coords
    if (startCoords) {
      const startIcon = L.divIcon({
        className: 'route-marker',
        html: `<div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: #16A34A;
          color: white; font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        ">S</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      L.marker([startCoords.lat, startCoords.lng], { icon: startIcon }).addTo(map)
        .bindPopup('<b>Start Location</b>')
      allLatLngs.push([startCoords.lat, startCoords.lng])
    }

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
      allLatLngs.push([p.latitude, p.longitude])

      const vendors = p.vendors?.join(', ') || ''
      marker.bindPopup(`<div style="font-size:12px;line-height:1.4;">
        <b>${p.retailer_name} #${p.store_number}</b><br/>
        ${p.city || ''}${p.city && p.state ? ', ' : ''}${p.state || ''}<br/>
        ${vendors ? vendors + '<br/>' : ''}
        ${p.drive_time_min ? Math.round(p.drive_time_min) + ' min drive &bull; ' : ''}${p.drive_distance_mi ? p.drive_distance_mi + ' mi' : ''}
        ${p.earnings ? '<br/><b>$' + p.earnings + '</b>' : ''}
      </div>`)
    })

    // Geocode end address and add end marker, then draw route
    const drawRoute = (endCoords) => {
      if (endCoords) {
        const endIcon = L.divIcon({
          className: 'route-marker',
          html: `<div style="
            width: 28px; height: 28px; border-radius: 50%;
            background: #DC2626;
            color: white; font-size: 13px; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          ">E</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        if (mapInstance.current) {
          L.marker([endCoords.lat, endCoords.lng], { icon: endIcon }).addTo(mapInstance.current)
            .bindPopup('<b>End Location</b>')
          allLatLngs.push([endCoords.lat, endCoords.lng])
          mapInstance.current.fitBounds(allLatLngs, { padding: [30, 30] })
        }
      }

      // Build OSRM coords: start + stops + end
      if (points.length >= 1) {
        const osrmPoints = []
        if (startCoords) osrmPoints.push(`${startCoords.lng},${startCoords.lat}`)
        points.forEach(p => osrmPoints.push(`${p.longitude},${p.latitude}`))
        if (endCoords) osrmPoints.push(`${endCoords.lng},${endCoords.lat}`)

        if (osrmPoints.length >= 2) {
          // Try OSRM for road routes, retry once on failure
          const fetchRoute = (attempt = 1) => {
            fetch(`https://router.project-osrm.org/route/v1/driving/${osrmPoints.join(';')}?overview=full&geometries=geojson`)
              .then(r => r.json())
              .then(data => {
                if (data.code === 'Ok' && data.routes?.[0]?.geometry && mapInstance.current) {
                  L.geoJSON(data.routes[0].geometry, {
                    style: { color: '#2563EB', weight: 4, opacity: 0.7 },
                  }).addTo(mapInstance.current)
                } else if (attempt < 2) {
                  setTimeout(() => fetchRoute(2), 1000)
                }
              })
              .catch(() => {
                if (attempt < 2) {
                  setTimeout(() => fetchRoute(2), 1000)
                }
                // No fallback straight lines — just show markers without route line
              })
          }
          fetchRoute()
        }
      }
    }

    // Fit map initially to stop markers
    if (allLatLngs.length === 1) {
      map.setView(allLatLngs[0], 12)
    } else if (allLatLngs.length > 1) {
      map.fitBounds(allLatLngs, { padding: [30, 30] })
    }

    // Get end coordinates — use startCoords if same address or geocode
    if (startCoords && (!endAddress || endAddress === '')) {
      drawRoute(startCoords)
    } else if (endAddress) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endAddress)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'ShopRight/1.0' },
      })
        .then(r => r.json())
        .then(results => {
          if (results?.[0]) {
            drawRoute({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) })
          } else if (startCoords) {
            drawRoute(startCoords)
          } else {
            drawRoute(null)
          }
        })
        .catch(() => drawRoute(startCoords || null))
    } else {
      drawRoute(null)
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [route, startCoords, endAddress])

  return <div ref={mapRef} className="w-full h-56 rounded-xl border border-gray-200 bg-gray-100" />
}

export default RouteMap
