import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { trackingService, Location, TrackingStats } from '../services/trackingService';
import MapboxMap from './MapboxMap';
import LocationsTable from './LocationsTable';
import StatsCards from './StatsCards';
import HistoryModal from './HistoryModal';

const AdminDashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const socketRef = useRef<Socket | null>(null);

  // URL del servidor Socket.IO
  const SOCKET_URL = 'https://backfiscamotov2.onrender.com';

  useEffect(() => {
    // Conectar al servidor Socket.IO
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('Conectado al servidor Socket.IO');
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Desconectado del servidor:', reason);
      setError('Conexión perdida con el servidor');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Error de conexión Socket.IO:', error);
      setError('Error al conectar con el servidor');
    });

    // Escuchar eventos de ubicación en tiempo real
    newSocket.on('location:realtime', (data: { userId: string; location: Location; timestamp: string }) => {
      console.log('Ubicación en tiempo real recibida:', data);

      setLocations(prev => {
        // Buscar si el usuario ya existe
        const existingIndex = prev.findIndex(loc => loc.userId === data.userId);

        if (existingIndex >= 0) {
          // Actualizar ubicación existente
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            accuracy: data.location.accuracy,
            timestamp: data.location.timestamp || data.timestamp,
            online: true,
            lastUpdate: data.timestamp
          };
          return updated;
        } else {
          // Agregar nueva ubicación
          return [...prev, {
            userId: data.userId,
            username: data.location.username || `Fiscalizador ${data.userId}`,
            email: data.location.email,
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            accuracy: data.location.accuracy,
            timestamp: data.location.timestamp || data.timestamp,
            online: true,
            lastUpdate: data.timestamp
          }];
        }
      });
    });

    // Escuchar cambios en el estado del tracking
    newSocket.on('tracking:status', (data: { active: boolean; updatedBy?: string; timestamp?: string }) => {
      console.log('Estado del tracking cambiado:', data);
      setIsTrackingActive(data.active);
    });

    // Escuchar estadísticas
    newSocket.on('tracking:stats', (data: TrackingStats) => {
      console.log('Estadísticas recibidas:', data);
      setStats(data);
    });

    // Escuchar todas las ubicaciones
    newSocket.on('location:allLocations', (data: Location[]) => {
      console.log('Todas las ubicaciones:', data);
      setLocations(data);
      setLastUpdate(new Date());
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    // Cargar datos iniciales
    fetchInitialData();

    // Cleanup
    return () => {
      newSocket.close();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Auto-refresh de ubicaciones
  useEffect(() => {
    if (!autoRefresh || !socket) return;

    const interval = setInterval(() => {
      fetchLocations();
    }, 15000); // Actualizar cada 15 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, socket]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Cargar datos en paralelo
      const [statsData, locationsData] = await Promise.all([
        trackingService.getStats().catch(err => {
          console.error('Error obteniendo estadísticas:', err);
          return null;
        }),
        trackingService.getAllLocations().catch(err => {
          console.error('Error obteniendo ubicaciones:', err);
          return [];
        })
      ]);

      setStats(statsData);
      if (statsData) {
        setIsTrackingActive(statsData.active);
      }
      setLocations(locationsData);
      setLastUpdate(new Date());

      // Solicitar estado actual vía Socket.IO
      if (socket) {
        socket.emit('tracking:getStatus');
        socket.emit('tracking:getStats');
        socket.emit('location:getAll');
      }
    } catch (err) {
      setError('Error al cargar los datos iniciales');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const locationsData = await trackingService.getAllLocations();
      setLocations(locationsData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error actualizando ubicaciones:', err);
    }
  };

  const toggleTracking = () => {
    if (!socket) {
      setError('No hay conexión con el servidor');
      return;
    }

    setLoading(true);
    const newStatus = !isTrackingActive;

    socket.emit('tracking:setStatus', { active: newStatus }, (response: any) => {
      console.log('Respuesta del servidor:', response);
      setLoading(false);
    });
  };

  const handleViewHistory = (userId: string) => {
    const user = locations.find(l => l.userId === userId);
    setSelectedUser(userId);
    setSelectedUserName(user?.username || user?.email || userId);
    setShowHistoryModal(true);
  };

  const handleCleanup = async () => {
    if (!window.confirm('¿Estás seguro de que quieres limpiar los datos antiguos?')) {
      return;
    }

    try {
      const result = await trackingService.cleanup(7); // Mantener datos de 7 días
      alert(`Limpieza completada. Se eliminaron ${result.deletedCount} registros.`);
      fetchInitialData();
    } catch (err) {
      alert('Error al limpiar los datos');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                🚴‍♂️ Panel de Administración - FISCAMOTO
              </h1>
              <p className="text-gray-600 mt-2">
                Sistema de Tracking GPS en Tiempo Real
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Última actualización: {lastUpdate.toLocaleTimeString('es-PE')}
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  autoRefresh
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                {autoRefresh ? '🔄 Auto-actualización ON' : '⏸️ Auto-actualización OFF'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <StatsCards
          stats={stats}
          isTrackingActive={isTrackingActive}
          onToggleTracking={toggleTracking}
          loading={loading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                📍 Ubicaciones en Tiempo Real
              </h2>
              <MapboxMap
                locations={locations}
                height="500px"
              />
            </div>
          </div>
        </div>

        <LocationsTable
          locations={locations}
          onViewHistory={handleViewHistory}
          onRefresh={fetchLocations}
          loading={loading}
        />

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleCleanup}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            🧹 Limpiar datos antiguos
          </button>
        </div>

        <HistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          userId={selectedUser || ''}
          userName={selectedUserName || undefined}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
