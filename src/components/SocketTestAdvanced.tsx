import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  type: 'connection' | 'server' | 'client' | 'error' | 'location' | 'api';
}

interface Location {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  online?: boolean;
  lastUpdate?: string;
  username?: string;
  email?: string;
}

interface TrackingStats {
  active: boolean;
  totalActive: number;
  online: number;
  totalLocations: number;
  activeUsers24h: number;
  logInterval: number;
}

interface HistoryPagination {
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  currentPage: number;
}

export const SocketTestAdvanced: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000');

  // Estado del tracking
  const [userId, setUserId] = useState<string>('fiscalizador-001');
  const [trackingActive, setTrackingActive] = useState<boolean>(false);
  const [trackingStatus, setTrackingStatus] = useState<{ active: boolean; updatedAt?: string } | null>(null);

  // Ubicaciones
  const [activeLocations, setActiveLocations] = useState<Location[]>([]);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const [historyPagination, setHistoryPagination] = useState<HistoryPagination | null>(null);

  // GPS
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [watchId, setWatchId] = useState<number | null>(null);

  // Estado de la API REST
  const [apiToken, setApiToken] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('http://localhost:4000');

  // Parámetros para historial
  const [historyLimit, setHistoryLimit] = useState<number>(100);
  const [historyOffset, setHistoryOffset] = useState<number>(0);
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');

  const addMessage = (text: string, type: Message['type'] = 'connection') => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: new Date(),
      type
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const connectToServer = () => {
    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(serverUrl);
    setSocket(newSocket);

    // Eventos básicos
    newSocket.on('connect', () => {
      setIsConnected(true);
      addMessage(`✅ Conectado con ID: ${newSocket.id}`, 'connection');
      // Pedir estado actual del tracking
      newSocket.emit('tracking:getStatus');
      newSocket.emit('tracking:getStats');
    });

    newSocket.on('welcome', (data: any) => {
      addMessage(`👋 Servidor: ${data.message}`, 'server');
    });

    // Eventos de tracking GPS
    newSocket.on('location:confirmed', (data: any) => {
      addMessage(`✅ Ubicación confirmada para usuario ${data.userId}`, 'server');
    });

    newSocket.on('location:error', (data: { message: string }) => {
      addMessage(`❌ Error de ubicación: ${data.message}`, 'error');
    });

    newSocket.on('location:realtime', (data: { userId: string; location: Location; timestamp: string }) => {
      addMessage(`📍 Ubicación en tiempo real - Usuario ${data.userId}: Lat=${data.location.latitude}, Lng=${data.location.longitude}`, 'location');
      // Actualizar lista activa
      setActiveLocations(prev => {
        const filtered = prev.filter(l => l.userId !== data.userId);
        return [...filtered, {
          userId: data.userId,
          ...data.location,
          online: true,
          timestamp: data.timestamp,
          lastUpdate: data.timestamp
        }];
      });
    });

    newSocket.on('location:allLocations', (data: Location[]) => {
      addMessage(`📊 Recibidas ${data.length} ubicaciones activas`, 'location');
      setActiveLocations(data);
    });

    // Eventos de tracking status
    newSocket.on('tracking:status', (data: { active: boolean; updatedAt?: string }) => {
      setTrackingStatus(data);
      setTrackingActive(data.active);
      addMessage(`📊 Estado del tracking: ${data.active ? 'ACTIVO' : 'INACTIVO'}`, 'server');
    });

    newSocket.on('tracking:statusChanged', (data: { active: boolean; updatedBy: string; timestamp: string }) => {
      setTrackingActive(data.active);
      setTrackingStatus({ active: data.active, updatedAt: data.timestamp });
      addMessage(`🔄 Tracking ${data.active ? 'ACTIVADO' : 'DESACTIVADO'} por ${data.updatedBy}`, 'server');
    });

    newSocket.on('tracking:stats', (data: TrackingStats) => {
      setTrackingStats(data);
      addMessage(`📊 Estadísticas: ${data.totalActive} activos, ${data.online} online`, 'server');
    });

    newSocket.on('tracking:statusResponse', (data: { success: boolean; message: string; active: boolean }) => {
      setTrackingActive(data.active);
      addMessage(`📊 Respuesta: ${data.message}`, 'server');
    });

    // Eventos de cleanup
    newSocket.on('tracking:cleanupResponse', (data: any) => {
      addMessage(`🧹 Limpieza completada: ${JSON.stringify(data)}`, 'server');
    });

    // Otros eventos
    newSocket.on('ping', (callback: Function) => {
      callback();
      addMessage('🏓 Ping respondido', 'server');
    });

    newSocket.on('pong', (data: { timestamp: string }) => {
      addMessage(`🏓 Pong recibido: ${new Date(data.timestamp).toLocaleTimeString()}`, 'server');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      addMessage(`❌ Desconectado: ${reason}`, 'error');
    });

    newSocket.on('connect_error', (error) => {
      addMessage(`❌ Error de conexión: ${error.message}`, 'error');
    });
  };

  // Funciones de Socket.IO
  const disconnectFromServer = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      addMessage('🔌 Desconectado manualmente', 'connection');
    }
  };

  // GPS Functions
  const sendLocation = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    if (!navigator.geolocation) {
      addMessage('❌ Tu navegador no soporta geolocalización', 'error');
      return;
    }

    addMessage('📍 Obteniendo ubicación GPS...', 'client');
    setLocationPermission('prompt');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationPermission('granted');
        const locationData = {
          userId: userId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        setCurrentLocation(position);
        addMessage(`✅ Ubicación obtenida: Lat=${locationData.latitude}, Lng=${locationData.longitude}`, 'location');
        socket.emit('location:update', locationData);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermission('denied');
          addMessage('❌ Permiso de ubicación denegado. Por favor, permite el acceso a tu ubicación', 'error');
          addMessage('💡 Busca el ícono de 📍 o 🔒 en la barra de direcciones y haz clic en "Permitir"', 'error');
        } else {
          let errorMessage = '❌ Error obteniendo ubicación: ';
          switch(error.code) {
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'La información de ubicación no está disponible';
              addMessage('💡 Intenta moverte a una área con mejor recepción de señal', 'error');
              break;
            case error.TIMEOUT:
              errorMessage += 'Tiempo de espera agotado (30s)';
              addMessage('💡 Posibles causas:', 'error');
              addMessage('   • Señal GPS débil (interiores)', 'error');
              addMessage('   • Permiso denegado o bloqueado', 'error');
              addMessage('   • GPS desactivado en el dispositivo', 'error');
              addMessage('💡 Intenta: habilitar GPS y permitir ubicación en el navegador', 'error');
              break;
            default:
              errorMessage += error.message;
              break;
          }
          addMessage(errorMessage, 'error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // Aumentado a 30 segundos
        maximumAge: 60000 // Permitir ubicaciones cacheadas de hasta 1 minuto
      }
    );
  };

  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      addMessage('❌ Tu navegador no soporta geolocalización', 'error');
      return;
    }

    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(result.state as 'prompt' | 'granted' | 'denied');

        if (result.state === 'granted') {
          addMessage('✅ Permiso de ubicación ya concedido', 'location');
        } else if (result.state === 'prompt') {
          addMessage('📍 Se solicitará permiso de ubicación...', 'client');
        } else {
          addMessage('❌ Permiso de ubicación denegado. Actívalo en la configuración del navegador', 'error');
        }

        result.addEventListener('change', () => {
          setLocationPermission(result.state as 'prompt' | 'granted' | 'denied');
        });
      } catch (error) {
        addMessage('⚠️ No se pudo verificar el estado del permiso de ubicación', 'error');
      }
    }
  };

  const toggleTracking = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    if (!trackingActive && locationPermission !== 'granted') {
      // Si vamos a activar el tracking y no tenemos permiso, lo solicitamos primero
      addMessage('📍 Se necesita permiso de ubicación para activar el tracking', 'client');
      setLocationPermission('prompt');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationPermission('granted');
          setCurrentLocation(position);
          addMessage('✅ Permiso concedido, activando tracking...', 'location');
          const newStatus = !trackingActive;
          setTrackingActive(newStatus);
          socket.emit('tracking:setStatus', { active: newStatus, userId: userId });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermission('denied');
            addMessage('❌ Permiso denegado. No se puede activar el tracking', 'error');
          }
        }
      );
    } else {
      // Si ya tenemos permiso o vamos a desactivar
      const newStatus = !trackingActive;
      addMessage(`${newStatus ? '🟢' : '🔴'} ${newStatus ? 'Activando' : 'Desactivando'} tracking...`, 'client');
      socket.emit('tracking:setStatus', { active: newStatus, userId: userId });
    }
  };

  const requestLocations = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    socket.emit('location:getAll');
    addMessage('📍 Solicitando ubicaciones activas...', 'client');
  };

  const requestLocationsFromDB = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    socket.emit('location:getAllFromDB');
    addMessage('📍 Solicitando ubicaciones desde MySQL...', 'client');
  };

  const requestStats = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    socket.emit('tracking:getStats');
    addMessage('📊 Solicitando estadísticas...', 'client');
  };

  const requestCleanup = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    socket.emit('tracking:cleanup', { daysToKeep: 7 });
    addMessage('🧹 Solicitando limpieza de datos inactivos...', 'client');
  };

  // Funciones de API REST
  const fetchTrackingStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/tracking/stats`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        addMessage(`✅ API Stats: ${data.data.active ? 'Activo' : 'Inactivo'}`, 'api');
        setTrackingStats(data.data);
        setTrackingActive(data.data.active);
      } else {
        addMessage(`❌ Error API: ${response.status}`, 'api');
      }
    } catch (error) {
      addMessage(`❌ Error de API: ${error}`, 'error');
    }
  };

  const fetchAllLocations = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/locations`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        addMessage(`✅ API: ${data.data.total} ubicaciones obtenidas`, 'api');
        setActiveLocations(data.data.locations);
      } else {
        addMessage(`❌ Error API: ${response.status}`, 'api');
      }
    } catch (error) {
      addMessage(`❌ Error de API: ${error}`, 'error');
    }
  };

  const fetchUserLocation = async () => {
    if (!selectedUserId) {
      addMessage('❌ Selecciona un userId para ver su última ubicación', 'error');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/locations/user/${selectedUserId}`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        addMessage(`✅ API: Última ubicación de ${data.data.username || selectedUserId}`, 'api');
        setActiveLocations([data.data]);
      } else {
        addMessage(`❌ Error API: ${response.status}`, 'api');
      }
    } catch (error) {
      addMessage(`❌ Error de API: ${error}`, 'error');
    }
  };

  const fetchUserHistory = async () => {
    if (!selectedUserId) {
      addMessage('❌ Selecciona un userId para ver historial', 'error');
      return;
    }

    const params = new URLSearchParams();
    params.append('limit', historyLimit.toString());
    params.append('offset', historyOffset.toString());
    if (historyStartDate) params.append('startDate', historyStartDate);
    if (historyEndDate) params.append('endDate', historyEndDate);

    try {
      const response = await fetch(`${apiUrl}/api/locations/history/${selectedUserId}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        addMessage(`✅ API: ${data.data.history.length} registros obtenidos`, 'api');
        setLocationHistory(data.data.history);
        setHistoryPagination(data.data.pagination);
      } else {
        addMessage(`❌ Error API: ${response.status}`, 'api');
      }
    } catch (error) {
      addMessage(`❌ Error de API: ${error}`, 'error');
    }
  };

  const performCleanupAPI = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/tracking/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ daysToKeep: 7 })
      });

      if (response.ok) {
        const data = await response.json();
        addMessage(`✅ API: ${data.message}`, 'api');
      } else {
        addMessage(`❌ Error API: ${response.status}`, 'api');
      }
    } catch (error) {
      addMessage(`❌ Error de API: ${error}`, 'error');
    }
  };

  // Auto-tracking cuando está activo
  useEffect(() => {
    if (isConnected && trackingActive && navigator.geolocation && socket) {
      addMessage('🟢 Iniciando tracking GPS en tiempo real...', 'client');

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const locationData = {
            userId: userId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };

          setCurrentLocation(position);
          // Verificar que el socket esté conectado antes de emitir
          if (socket.connected) {
            socket.emit('location:update', locationData);
          }
        },
        (error) => {
          // No mostrar errores de timeout como error fatal
          if (error.code !== error.TIMEOUT) {
            addMessage(`⚠️ Error en tracking GPS: ${error.message}`, 'error');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );

      setWatchId(id);
    }
  }, [trackingActive]); // Eliminamos isConnected y socket de las dependencias

  // Efecto para detener el tracking cuando se desactiva
  useEffect(() => {
    if (!trackingActive && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      addMessage('🔴 Deteniendo tracking GPS...', 'client');
    }
  }, [trackingActive, watchId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [socket, watchId]);

  const getMessageStyle = (type: Message['type']) => {
    switch (type) {
      case 'connection': return 'bg-blue-100 text-blue-800';
      case 'server': return 'bg-green-100 text-green-800';
      case 'client': return 'bg-purple-100 text-purple-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'location': return 'bg-yellow-100 text-yellow-800';
      case 'api': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🚀 Tracking GPS - Fiscamoto</h1>

      {/* Conexión */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🔌 Conexión Socket.IO</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">URL del Servidor</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              disabled={isConnected}
            />
          </div>
          <button
            onClick={connectToServer}
            disabled={isConnected}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
          >
            Conectar
          </button>
          <button
            onClick={disconnectFromServer}
            disabled={!isConnected}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400"
          >
            Desconectar
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className="text-sm">
            {isConnected ? `Conectado (ID: ${socket?.id})` : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Configuración API */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🔐 API REST</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">URL de API</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Token JWT</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Bearer token..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Estado del Tracking */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">📊 Estado del Tracking</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-white rounded">
            <div className={`text-2xl font-bold ${trackingActive ? 'text-green-600' : 'text-red-600'}`}>
              {trackingActive ? 'ACTIVO' : 'INACTIVO'}
            </div>
            <div className="text-sm text-gray-600">Estado Global</div>
          </div>
          {trackingStats && (
            <>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-blue-600">{trackingStats.totalActive}</div>
                <div className="text-sm text-gray-600">Usuarios Activos</div>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-green-600">{trackingStats.online}</div>
                <div className="text-sm text-gray-600">Usuarios Online</div>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <div className="text-2xl font-bold text-purple-600">{trackingStats.totalLocations}</div>
                <div className="text-sm text-gray-600">Total Registros</div>
              </div>
            </>
          )}
        </div>
        <div className="text-sm text-gray-600">
          Intervalo de guardado: {trackingStats?.logInterval || 5} minutos
        </div>
      </div>

      {/* Control de Tracking */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🎛️ Control de Tracking</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">User ID:</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  locationPermission === 'granted' ? 'bg-green-500' :
                  locationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-gray-700 text-sm">
                  GPS: {
                    locationPermission === 'granted' ? 'Permitido' :
                    locationPermission === 'denied' ? 'Denegado' : 'Pendiente'
                  }
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${trackingActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-700">
                  Tracking: {trackingActive ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
            </div>
          </div>

          {/* Ubicación actual */}
          {currentLocation && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-1">📍 Tu ubicación actual:</h4>
              <p className="text-sm text-blue-700">
                Lat: {currentLocation.coords.latitude.toFixed(6)},
                Lng: {currentLocation.coords.longitude.toFixed(6)}
              </p>
              <p className="text-xs text-blue-600">
                Precisión: ±{currentLocation.coords.accuracy.toFixed(0)} metros
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={sendLocation}
              disabled={!isConnected}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📍 Obtener Ubicación
            </button>
            <button
              onClick={toggleTracking}
              disabled={!isConnected}
              className={`px-4 py-2 rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${
                trackingActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {trackingActive ? '🔴 Detener Tracking' : '🟢 Iniciar Tracking'}
            </button>
            <button
              onClick={requestLocations}
              disabled={!isConnected}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📍 Ver Activos (Redis)
            </button>
            <button
              onClick={requestLocationsFromDB}
              disabled={!isConnected}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📍 Ver Activos (MySQL)
            </button>
            <button
              onClick={requestStats}
              disabled={!isConnected}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📊 Ver Estadísticas
            </button>
            <button
              onClick={requestCleanup}
              disabled={!isConnected}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              🧹 Limpiar Inactivos
            </button>
            <button
              onClick={requestLocationPermission}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              🔍 Verificar GPS
            </button>
          </div>

          {locationPermission === 'denied' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                ⚠️ El permiso de ubicación fue denegado. Para usar el GPS:
              </p>
              <ul className="text-xs text-red-600 mt-1 ml-4 list-disc">
                <li>Chrome: Click en el ícono de 📍 en la barra de direcciones</li>
                <li>Firefox: Click en el ícono de 🛡️ en la barra de direcciones</li>
                <li>Selecciona "Permitir" o "Siempre permitir en este sitio"</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* API REST Actions */}
      <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🔌 API REST Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={fetchTrackingStats}
            disabled={!apiToken}
            className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 text-sm"
          >
            Obtener Stats
          </button>
          <button
            onClick={fetchAllLocations}
            disabled={!apiToken}
            className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 text-sm"
          >
            Ver Todas
          </button>
          <button
            onClick={performCleanupAPI}
            disabled={!apiToken}
            className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400 text-sm"
          >
            Limpiar API
          </button>
          <button
            onClick={fetchUserLocation}
            disabled={!apiToken || !selectedUserId}
            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 text-sm"
          >
            Ver Usuario
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              placeholder="User ID para consulta"
              className="px-3 py-2 border border-gray-300 rounded-lg flex-1"
            />
            <button
              onClick={fetchUserHistory}
              disabled={!apiToken || !selectedUserId}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400"
            >
              Ver Historial
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <input
              type="number"
              value={historyLimit}
              onChange={(e) => setHistoryLimit(Number(e.target.value))}
              placeholder="Límite"
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <input
              type="number"
              value={historyOffset}
              onChange={(e) => setHistoryOffset(Number(e.target.value))}
              placeholder="Offset"
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <input
              type="datetime-local"
              value={historyStartDate}
              onChange={(e) => setHistoryStartDate(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <input
              type="datetime-local"
              value={historyEndDate}
              onChange={(e) => setHistoryEndDate(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Paginación del historial */}
      {historyPagination && (
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">
            Página {historyPagination.currentPage} de {historyPagination.totalPages}
            (Total: {historyPagination.total} registros)
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setHistoryOffset(Math.max(0, historyOffset - historyLimit));
                fetchUserHistory();
              }}
              disabled={historyOffset === 0}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm disabled:bg-gray-300"
            >
              Anterior
            </button>
            <button
              onClick={() => {
                if (historyOffset + historyLimit < historyPagination.total) {
                  setHistoryOffset(historyOffset + historyLimit);
                  fetchUserHistory();
                }
              }}
              disabled={historyOffset + historyLimit >= historyPagination.total}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm disabled:bg-gray-300"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Ubicaciones Activas */}
      {activeLocations.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">📍 Ubicaciones Activas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeLocations.map((loc) => (
              <div key={`${loc.userId}-${loc.timestamp || loc.lastUpdate || Date.now()}`} className="p-2 bg-white rounded border">
                <div className="flex justify-between items-start">
                  <div>
                    <strong>Usuario {loc.userId}</strong>
                    {loc.username && <span className="ml-2 text-sm text-gray-500">({loc.username})</span>}
                    {loc.online && <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded">ONLINE</span>}
                  </div>
                  <span className="text-xs text-gray-500">{new Date(loc.timestamp || loc.lastUpdate || '').toLocaleTimeString()}</span>
                </div>
                <div className="text-sm mt-1">
                  Lat: {loc.latitude}, Lng: {loc.longitude}
                  {loc.accuracy && `, Precisión: ±${loc.accuracy.toFixed(1)}m`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      {locationHistory.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">📜 Historial de Ubicaciones (User {selectedUserId})</h3>
          <div className="max-h-48 overflow-y-auto">
            {locationHistory.slice(0, 10).map((loc, idx) => (
              <div key={`${loc.timestamp}-${historyOffset + idx}`} className="p-2 bg-white rounded border mb-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Registro #{historyOffset + idx + 1}</span>
                  <span>{new Date(loc.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  Lat: {loc.latitude}, Lng: {loc.longitude}
                  {loc.accuracy && `, Precisión: ±${loc.accuracy.toFixed(1)}m`}
                </div>
              </div>
            ))}
          </div>
          {locationHistory.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">
              Mostrando 10 de {locationHistory.length + historyOffset} registros
            </p>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">📝 Logs del Sistema</h3>
          <button
            onClick={() => setMessages([])}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Limpiar
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto space-y-1">
          {messages.map((message, idx) => (
            <div key={`${message.id}-${idx}`} className={`p-2 rounded ${getMessageStyle(message.type)}`}>
              <span className="text-xs text-gray-500">
                [{message.timestamp.toLocaleTimeString()}]
              </span>{' '}
              <span>{message.text}</span>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-gray-500 py-8">No hay mensajes aún</p>
          )}
        </div>
      </div>
    </div>
  );
};