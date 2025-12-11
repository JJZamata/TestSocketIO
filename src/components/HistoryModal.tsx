import React, { useEffect, useState } from 'react';
import { trackingService, LocationHistory } from '../services/trackingService';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName
}) => {
  const [history, setHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  const pageSize = 50;

  useEffect(() => {
    if (isOpen && userId) {
      fetchHistory(0, true);
    }
  }, [isOpen, userId]);

  const fetchHistory = async (pageNum: number, reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await trackingService.getHistory(userId, {
        limit: pageSize,
        offset: pageNum * pageSize,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString()
      });

      if (reset) {
        setHistory(response.data);
      } else {
        setHistory(prev => [...prev, ...response.data]);
      }

      setHasMore(response.pagination.page < response.pagination.totalPages - 1);
    } catch (err) {
      setError('Error al cargar el historial');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchHistory(nextPage, false);
    }
  };

  const handleFilter = () => {
    setPage(0);
    setHasMore(true);
    fetchHistory(0, true);
  };

  const exportCSV = () => {
    if (history.length === 0) return;

    const csv = [
      ['Fecha', 'Latitud', 'Longitud', 'Precisión'],
      ...history.map(h => [
        new Date(h.timestamp).toLocaleString('es-PE'),
        h.latitude.toString(),
        h.longitude.toString(),
        h.accuracy?.toString() || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${userId}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                📍 Historial de Ubicaciones
              </h2>
              <p className="text-gray-600 mt-1">
                Fiscalizador: {userName || userId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de inicio
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de fin
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleFilter}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Filtrar
              </button>
              <button
                onClick={exportCSV}
                disabled={history.length === 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar CSV"
              >
                📥
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-center">
              {error}
            </div>
          )}

          {history.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">
              No hay datos de ubicación para el período seleccionado
            </div>
          )}

          {history.length > 0 && (
            <div className="p-6">
              <div className="mb-4 text-sm text-gray-600">
                Mostrando {history.length} ubicaciones
              </div>
              <div className="space-y-2">
                {history.map((location, index) => (
                  <div
                    key={`${location.timestamp}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(location.timestamp).toLocaleString('es-PE')}
                      </div>
                    </div>
                    <div className="text-right">
                      {location.accuracy && (
                        <div className={`text-xs px-2 py-1 rounded ${
                          location.accuracy <= 10
                            ? 'bg-green-100 text-green-800'
                            : location.accuracy <= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          ±{location.accuracy}m
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-600">Cargando historial...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;