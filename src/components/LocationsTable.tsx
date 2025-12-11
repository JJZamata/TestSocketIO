import React from 'react';
import { Location } from '../services/trackingService';

interface LocationsTableProps {
  locations: Location[];
  onViewHistory: (userId: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

const LocationsTable: React.FC<LocationsTableProps> = ({
  locations,
  onViewHistory,
  onRefresh,
  loading = false
}) => {
  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTimeDifference = (timestamp: string) => {
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          📋 Detalle de Fiscalizadores
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Actualizando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Usuario</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Estado</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Ubicación</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Precisión</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Última Actualización</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  {loading ? 'Cargando datos...' : 'No hay fiscalizadores activos'}
                </td>
              </tr>
            ) : (
              locations.map((location, index) => (
                <tr
                  key={location.userId}
                  className={`border-b hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="py-3 px-4 font-mono text-xs">
                    {location.userId}
                  </td>
                  <td className="py-3 px-4 font-medium">
                    {location.username || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm">
                    {location.email || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        location.online
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 mr-2 rounded-full ${
                          location.online ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      ></span>
                      {location.online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs">
                      {formatCoordinates(location.latitude, location.longitude)}
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 text-xs mt-1 inline-block"
                    >
                      Ver en mapa →
                    </a>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {location.accuracy ? (
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          location.accuracy <= 10
                            ? 'bg-green-100 text-green-800'
                            : location.accuracy <= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        ±{location.accuracy}m
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs text-gray-600">
                      {getTimeDifference(location.timestamp)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(location.timestamp)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onViewHistory(location.userId)}
                      className="px-3 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 transition-colors"
                    >
                      Ver Historial
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {locations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
          <span>
            Total: <strong>{locations.length}</strong> fiscalizadores
          </span>
          <span>
            Online: <strong className="text-green-600">
              {locations.filter(l => l.online).length}
            </strong> |
            Offline: <strong className="text-red-600">
              {locations.filter(l => !l.online).length}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default LocationsTable;