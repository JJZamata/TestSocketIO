import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Location } from '../services/trackingService';
import { MAPBOX_CONFIG } from '../config/mapbox';

// Configurar token de Mapbox
mapboxgl.accessToken = MAPBOX_CONFIG.accessToken;

interface MapboxMapProps {
  locations: Location[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

const MapboxMap: React.FC<MapboxMapProps> = ({
  locations,
  center = MAPBOX_CONFIG.defaultCenter,
  zoom = MAPBOX_CONFIG.defaultZoom,
  height = '500px'
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Inicializar el mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_CONFIG.style,
      center: center,
      zoom: zoom,
    });

    // Agregar controles de navegación
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Actualizar marcadores cuando cambian las ubicaciones
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Limpiar marcadores existentes
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Crear marcadores para cada ubicación
    locations.forEach(location => {
      // Crear elemento HTML para el marcador
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.cssText = `
        width: 30px;
        height: 30px;
        background-color: ${location.online ? '#16a34a' : '#dc2626'};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
      `;

      // Agregar icono de usuario
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      `;

      // Crear popup con información
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'location-popup'
      }).setHTML(`
        <div style="padding: 10px; min-width: 200px;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">
            Fiscalizador: ${location.username || location.userId}
          </h3>
          <p style="margin: 5px 0; font-size: 14px;">
            <strong>Estado:</strong>
            <span style="color: ${location.online ? '#16a34a' : '#dc2626'}; font-weight: bold;">
              ${location.online ? 'Online' : 'Offline'}
            </span>
          </p>
          <p style="margin: 5px 0; font-size: 14px;">
            <strong>Coordenadas:</strong><br>
            <span style="font-family: monospace; font-size: 12px;">
              ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
            </span>
          </p>
          ${location.accuracy ? `
            <p style="margin: 5px 0; font-size: 14px;">
              <strong>Precisión:</strong> ±${location.accuracy}m
            </p>
          ` : ''}
          <p style="margin: 5px 0; font-size: 14px;">
            <strong>Última actualización:</strong><br>
            ${new Date(location.timestamp).toLocaleString('es-PE')}
          </p>
        </div>
      `);

      // Crear y agregar el marcador
      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      // Mostrar popup al hacer clic
      el.addEventListener('mouseenter', () => {
        popup.addTo(map.current!);
      });

      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      // Efecto hover
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      markersRef.current.push(marker);
    });

    // Ajustar el mapa para que todos los marcadores sean visibles
    if (locations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach(location => {
        bounds.extend([location.longitude, location.latitude]);
      });

      // Agregar padding para que los marcadores no estén en los bordes
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15
      });
    }
  }, [locations, mapLoaded]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: '100%',
        height: height,
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    />
  );
};

export default MapboxMap;