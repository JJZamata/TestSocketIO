// Configuración de Mapbox
// IMPORTANTE: Reemplaza TU_MAPBOX_ACCESS_TOKEN con tu token real
export const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoiemFtYXRhIiwiYSI6ImNtaTdsdWFrNTAyYmYybXEwM2IyNG56NTkifQ.Q6m56Slizgj0m6xAJ_yr_Q";

export const MAPBOX_CONFIG = {
  accessToken: MAPBOX_ACCESS_TOKEN,
  defaultCenter: [-77.0428, -12.0464] as [number, number], // Lima, Perú
  defaultZoom: 12,
  style: 'mapbox://styles/mapbox/streets-v12'
};