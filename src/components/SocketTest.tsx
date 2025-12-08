import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  type: 'connection' | 'server' | 'client' | 'error' | 'location';
}

interface Location {
  userId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

export const SocketTest: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('http://localhost:4000');
  const [userId, setUserId] = useState<string>('123');
  const [trackingActive, setTrackingActive] = useState<boolean>(false);
  const [activeLocations, setActiveLocations] = useState<Location[]>([]);
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [locationError, setLocationError] = useState<string>('');
  const [watchId, setWatchId] = useState<number | null>(null);

  const addMessage = (text: string, type: Message['type'] = 'connection') => {
    const newMessage: Message = {
      id: Date.now().toString(),
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

    newSocket.on('connect', () => {
      setIsConnected(true);
      addMessage(`✅ Conectado con ID: ${newSocket.id}`, 'connection');
    });

    newSocket.on('welcome', (data: { message: string }) => {
      addMessage(`👋 Servidor: ${data.message}`, 'server');
    });

    newSocket.on('message', (data: { text: string; from: string }) => {
      addMessage(`📨 ${data.from}: ${data.text}`, 'server');
    });

    // Eventos de tracking GPS
    newSocket.on('location:confirmed', (data: any) => {
      addMessage(`✅ Ubicación confirmada: ${data.message}`, 'server');
    });

    newSocket.on('location:error', (data: { message: string }) => {
      addMessage(`❌ Error de ubicación: ${data.message}`, 'error');
    });

    newSocket.on('location:realtime', (data: { userId: number; location: Location }) => {
      addMessage(`📍 Ubicación en tiempo real - Usuario ${data.userId}:`, 'location');
      addMessage(`   Lat: ${data.location.latitude}, Lng: ${data.location.longitude}`, 'location');
    });

    newSocket.on('location:allLocations', (data: Location[]) => {
      addMessage(`📊 Recibidas ${data.length} ubicaciones activas`, 'location');
      setActiveLocations(data);
    });

    newSocket.on('tracking:statusChanged', (data: { active: boolean; updatedBy: string }) => {
      setTrackingActive(data.active);
      addMessage(`🔄 Tracking ${data.active ? 'ACTIVADO' : 'DESACTIVADO'} por ${data.updatedBy}`, 'server');
    });

    newSocket.on('tracking:status', (data: { active: boolean }) => {
      setTrackingActive(data.active);
      addMessage(`📊 Estado del tracking: ${data.active ? 'ACTIVO' : 'INACTIVO'}`, 'server');
    });

    newSocket.on('tracking:statusResponse', (data: { success: boolean; message: string; active: boolean }) => {
      setTrackingActive(data.active);
      addMessage(`📊 Respuesta: ${data.message}`, 'server');
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

  const disconnectFromServer = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      addMessage('🔌 Desconectado manualmente', 'connection');
    }
  };

  const sendMessage = () => {
    if (socket && inputValue.trim()) {
      socket.emit('message', {
        text: inputValue,
        from: 'Cliente React'
      });
      addMessage(`📤 Tú: ${inputValue}`, 'client');
      setInputValue('');
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  // Funciones de tracking GPS
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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          userId: parseInt(userId),
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        setCurrentLocation(position);
        addMessage(`✅ Ubicación obtenida: Lat=${locationData.latitude}, Lng=${locationData.longitude}`, 'location');
        socket.emit('location:update', locationData);
      },
      (error) => {
        let errorMessage = '❌ Error obteniendo ubicación: ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Permiso denegado por el usuario';
            setLocationPermission('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Información de ubicación no disponible';
            break;
          case error.TIMEOUT:
            errorMessage += 'Tiempo de espera agotado';
            break;
          default:
            errorMessage += 'Error desconocido';
            break;
        }
        addMessage(errorMessage, 'error');
        setLocationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const getActiveLocations = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('📍 Solicitando ubicaciones activas...', 'client');
    socket.emit('location:getAll');
  };

  const toggleTracking = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    const newStatus = !trackingActive;
    addMessage(`${newStatus ? '🟢' : '🔴'} ${newStatus ? 'Activando' : 'Desactivando'} tracking...`, 'client');
    socket.emit('tracking:setStatus', { active: newStatus });
  };

  const ping = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('🏓 Enviando ping...', 'client');
    socket.emit('ping');
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

  // Enviar ubicación automáticamente cuando el tracking está activo
  useEffect(() => {
    if (isConnected && trackingActive && navigator.geolocation) {
      addMessage('🟢 Iniciando tracking GPS en tiempo real...', 'client');

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const locationData = {
            userId: parseInt(userId),
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };

          setCurrentLocation(position);
          socket?.emit('location:update', locationData);
        },
        (error) => {
          addMessage(`❌ Error en tracking GPS: ${error.message}`, 'error');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );

      setWatchId(id);

      return () => {
        if (id !== null) {
          navigator.geolocation.clearWatch(id);
          setWatchId(null);
        }
      };
    } else if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      addMessage('🔴 Deteniendo tracking GPS...', 'client');
    }
  }, [isConnected, trackingActive, userId]);

  // Verificar permisos de ubicación al cargar el componente
  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [socket, watchId]);

  const getMessageStyle = (type: Message['type']) => {
    switch (type) {
      case 'connection':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'server':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'client':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'location':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🔌 Cliente Socket.IO Test con GPS Tracking</h1>

      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="URL del servidor"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isConnected}
          />
          <button
            onClick={connectToServer}
            disabled={isConnected}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Conectar
          </button>
          <button
            onClick={disconnectFromServer}
            disabled={!isConnected}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Desconectar
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-gray-700">
              {isConnected ? `Conectado a ${serverUrl}` : 'Desconectado'}
            </span>
          </div>

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
      </div>

      {/* Controles de GPS Tracking */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">📍 GPS Tracking</h2>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="text-gray-700">User ID:</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConnected}
            />

            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${trackingActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-700">
                Tracking: {trackingActive ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {locationPermission !== 'granted' && (
              <button
                onClick={requestLocationPermission}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                🎯 Solicitar Permiso GPS
              </button>
            )}

            <button
              onClick={toggleTracking}
              disabled={!isConnected || locationPermission !== 'granted'}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {trackingActive ? '🔴 Desactivar Tracking' : '🟢 Activar Tracking'}
            </button>

            <button
              onClick={sendLocation}
              disabled={!isConnected || locationPermission !== 'granted'}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📍 Enviar Ubicación Manual
            </button>

            <button
              onClick={getActiveLocations}
              disabled={!isConnected}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📊 Ver Ubicaciones Activas
            </button>

            <button
              onClick={ping}
              disabled={!isConnected}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              🏓 Ping
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

      {/* Ubicaciones Activas */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">📍 Ubicaciones Activas</h3>
        {activeLocations.length === 0 ? (
          <p className="text-gray-500">No hay ubicaciones activas</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeLocations.map((loc, idx) => (
              <div key={idx} className="p-2 bg-white rounded border border-gray-200">
                <strong>Usuario {loc.userId}</strong>
                <br />
                <span className="text-sm">
                  Lat: {loc.latitude}, Lng: {loc.longitude}
                  {loc.accuracy && `, Precisión: ${loc.accuracy}m`}
                </span>
                <br />
                <span className="text-xs text-gray-500">
                  {new Date(loc.lastUpdate).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Escribe un mensaje..."
            disabled={!isConnected}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !inputValue.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Enviar
          </button>
          <button
            onClick={clearMessages}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay mensajes aún. Conéctate al servidor para comenzar.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg border ${getMessageStyle(message.type)}`}
            >
              <div className="flex justify-between items-start">
                <span className="flex-1">{message.text}</span>
                <span className="text-xs opacity-70 ml-2">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};