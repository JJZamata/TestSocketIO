import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  type: 'connection' | 'server' | 'client' | 'error' | 'location';
}

interface Location {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  online?: boolean;
  lastUpdate?: string;
}

export const SocketTest: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('http://localhost:4000');
  const [userId, setUserId] = useState<string>('fiscalizador-001');
  const [trackingActive, setTrackingActive] = useState<boolean>(false);
  const [activeLocations, setActiveLocations] = useState<Location[]>([]);
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [watchId, setWatchId] = useState<number | null>(null);
  
  // Usar ref para evitar problemas con closures en callbacks
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string>(userId);

  // Actualizar refs cuando cambien los valores
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const addMessage = (text: string, type: Message['type'] = 'connection') => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      addMessage(`✅ Conectado con ID: ${newSocket.id}`, 'connection');

      // Verificar estado del permiso GPS al conectar
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' })
          .then(result => {
            setLocationPermission(result.state as 'prompt' | 'granted' | 'denied');
            console.log('Estado del permiso GPS:', result.state);
          })
          .catch(err => {
            console.log('No se puede verificar el permiso GPS:', err);
          });
      }

      newSocket.emit('tracking:getStatus');
      newSocket.emit('tracking:getStats');
    });

    newSocket.on('welcome', (data: { message: string }) => {
      addMessage(`👋 Servidor: ${data.message}`, 'server');
    });

    newSocket.on('location:confirmed', (data: { message: string; userId: string; timestamp: string }) => {
      addMessage(`✅ Ubicación confirmada para fiscalizador ${data.userId}`, 'server');
    });

    newSocket.on('location:error', (data: { message: string }) => {
      addMessage(`❌ Error de ubicación: ${data.message}`, 'error');
    });

    newSocket.on('location:realtime', (data: { userId: string; location: Location; timestamp: string }) => {
      addMessage(`📍 Ubicación en tiempo real - Usuario ${data.userId}:`, 'location');
      addMessage(`   Lat: ${data.location.latitude}, Lng: ${data.location.longitude}`, 'location');
    });

    newSocket.on('location:allLocations', (data: Location[]) => {
      addMessage(`📊 Recibidas ${data.length} ubicaciones activas`, 'location');
      setActiveLocations(data);
    });

    newSocket.on('tracking:statusChanged', (data: { active: boolean; updatedBy: string; timestamp: string }) => {
      setTrackingActive(data.active);
      addMessage(`🔄 Tracking ${data.active ? 'ACTIVADO' : 'DESACTIVADO'} por ${data.updatedBy}`, 'server');
    });

    newSocket.on('tracking:status', (data: { active: boolean; updatedAt?: string }) => {
      setTrackingActive(data.active);
      addMessage(`📊 Estado del tracking: ${data.active ? 'ACTIVO' : 'INACTIVO'}`, 'server');
    });

    newSocket.on('tracking:statusResponse', (data: { success: boolean; message: string; active: boolean }) => {
      setTrackingActive(data.active);
      addMessage(`📊 Respuesta: ${data.message}`, 'server');
    });

    newSocket.on('tracking:stats', (data: any) => {
      addMessage(`📊 Estadísticas: ${JSON.stringify(data)}`, 'server');
    });

    newSocket.on('pong', (data: { timestamp: string }) => {
      addMessage(`🏓 Pong recibido: ${new Date(data.timestamp).toLocaleTimeString()}`, 'server');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      addMessage(`❌ Desconectado: ${reason}`, 'error');
      console.log('Socket desconectado. Razón:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Error de conexión:', error);
      addMessage(`❌ Error de conexión: ${error.message}`, 'error');
    });

    newSocket.on('error', (error) => {
      console.error('Error del socket:', error);
      addMessage(`❌ Error del socket: ${error.message || 'Error desconocido'}`, 'error');
    });
  };

  const disconnectFromServer = () => {
    if (socket) {
      console.log('Desconectando manualmente...');
      socket.disconnect();
      setSocket(null);
      socketRef.current = null;
      setIsConnected(false);
      addMessage('🔌 Desconectado manualmente', 'connection');
    }
  };

  const sendMessage = () => {
    if (socket && inputValue.trim()) {
      addMessage(`📤 Mensaje: ${inputValue} [Nota: el evento 'message' no está en la API oficial]`, 'client');
      setInputValue('');
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

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
        
        // Mensaje informativo sobre el estado del tracking automático
        if (trackingActive) {
          addMessage(`ℹ️ Tracking automático está activo - La ubicación se actualizará cada 15 segundos`, 'location');
        }
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
        timeout: 30000,
        maximumAge: 60000
      }
    );
  };

  const getActiveLocations = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('📍 [ADMIN] Solicitando ubicaciones activas...', 'client');
    socket.emit('location:getAll');
  };

  const getActiveLocationsFromDB = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('📍 [ADMIN] Solicitando ubicaciones desde MySQL...', 'client');
    socket.emit('location:getAllFromDB');
  };

  const cleanupData = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('🧹 [ADMIN] Ejecutando limpieza de datos...', 'client');
    socket.emit('tracking:cleanup', { daysToKeep: 7 });
  };

  const getSystemStats = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('📊 [ADMIN] Solicitando estadísticas del sistema...', 'client');
    socket.emit('tracking:getStats');
  };

  const requestGPSPermission = () => {
    if (!navigator.geolocation) {
      addMessage('❌ Tu navegador no soporta geolocalización', 'error');
      return;
    }

    addMessage('📍 Solicitando permiso de GPS...', 'client');
    console.log('requestGPSPermission: solicitando permiso');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('requestGPSPermission: permiso concedido');
        setLocationPermission('granted');
        setCurrentLocation(position);
        addMessage('✅ Permiso de GPS concedido. Listo para enviar ubicaciones.', 'location');
        
        // Si el tracking ya está activo, informar que se iniciará el envío automático
        if (trackingActive) {
          addMessage('🟢 El tracking está activo. Iniciando envío automático de ubicaciones...', 'location');
        }
      },
      (error) => {
        console.log('requestGPSPermission: error', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermission('denied');
          addMessage('❌ Permiso de GPS denegado. No se puede enviar ubicaciones.', 'error');
        } else {
          addMessage(`❌ Error obteniendo ubicación: ${error.message}`, 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );
  };

  const toggleTrackingAdmin = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      console.log('toggleTrackingAdmin: no hay conexión');
      return;
    }

    const newStatus = !trackingActive;
    const data = { active: newStatus };

    console.log('toggleTrackingAdmin: emitiendo tracking:setStatus', data);
    addMessage(`${newStatus ? '🟢' : '🔴'} [ADMIN] ${newStatus ? 'Activando' : 'Desactivando'} tracking global...`, 'client');

    socket.emit('tracking:setStatus', data, (response: any) => {
      console.log('Respuesta de tracking:setStatus:', response);
      if (response) {
        addMessage(`📊 [ADMIN] Respuesta: ${response.message || 'Sin mensaje'}`, 'server');
      }
    });
  };

  const ping = () => {
    if (!socket || !isConnected) {
      addMessage('❌ No hay conexión activa', 'error');
      return;
    }

    addMessage('🏓 Enviando ping...', 'client');
    socket.emit('ping');
  };

  // 🔧 EFECTO PRINCIPAL: Manejo del tracking automático
  useEffect(() => {
    console.log('🔄 useEffect tracking - Estado:', {
      isConnected,
      trackingActive,
      locationPermission,
      hasGeolocation: !!navigator.geolocation,
      hasSocket: !!socketRef.current,
      watchId
    });

    // Limpiar watchId anterior si existe
    if (watchId !== null) {
      console.log('🧹 Limpiando watchId anterior:', watchId);
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    // Condiciones para iniciar el tracking automático
    const shouldStartTracking = 
      isConnected && 
      trackingActive && 
      locationPermission === 'granted' && 
      navigator.geolocation && 
      socketRef.current;

    if (shouldStartTracking) {
      addMessage('🟢 Iniciando tracking automático - Enviando ubicación cada 15 segundos...', 'location');
      console.log('🟢 Iniciando watchPosition');

      const id = navigator.geolocation.watchPosition(
        (position) => {
          console.log('📍 watchPosition: Nueva ubicación obtenida');
          const locationData = {
            userId: userIdRef.current,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };

          setCurrentLocation(position);
          
          // Verificar que el socket esté conectado antes de emitir
          if (socketRef.current && socketRef.current.connected) {
            console.log('📤 Enviando ubicación automática:', locationData);
            socketRef.current.emit('location:update', locationData);
          } else {
            console.warn('⚠️ Socket no conectado, no se puede enviar ubicación');
          }
        },
        (error) => {
          // No mostrar errores de timeout como error fatal
          if (error.code !== error.TIMEOUT) {
            console.error('❌ Error en watchPosition:', error);
            addMessage(`⚠️ Error en tracking automático: ${error.message}`, 'error');
          } else {
            console.log('⏱️ Timeout en watchPosition (normal)');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );

      console.log('✅ watchPosition iniciado con ID:', id);
      setWatchId(id);

      // Cleanup cuando el efecto se desmonte o las dependencias cambien
      return () => {
        console.log('🧹 Limpiando watchPosition:', id);
        if (id !== null) {
          navigator.geolocation.clearWatch(id);
        }
      };
    } else {
      // Mostrar mensaje solo si el tracking está activo pero falta algo
      if (trackingActive && isConnected) {
        if (locationPermission !== 'granted') {
          console.log('⚠️ Tracking activo pero sin permiso GPS');
        } else if (!navigator.geolocation) {
          addMessage('❌ Tu navegador no soporta geolocalización', 'error');
        }
      } else if (!trackingActive && isConnected) {
        console.log('🔴 Tracking desactivado');
      }
    }

    // Cleanup general
    return () => {
      if (watchId !== null) {
        console.log('🧹 Cleanup final: limpiando watchId', watchId);
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isConnected, trackingActive, locationPermission]); // Solo dependencias esenciales

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

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
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🚴‍♂️ Fiscalizador - Sistema de Tracking GPS</h1>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-green-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-green-800">🚴‍♂️ Opciones de Fiscalizador</h2>

          <div className="space-y-4">
            <div>
              <label className="text-gray-700 font-medium block mb-2">ID Fiscalizador:</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isConnected}
                placeholder="Ej: fiscalizador-001"
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={sendLocation}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                📍 Enviar Ubicación Manual
              </button>

              <button
                onClick={requestGPSPermission}
                className={`w-full px-4 py-2 rounded-lg transition-colors ${
                  locationPermission === 'granted'
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : locationPermission === 'denied'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {locationPermission === 'granted'
                  ? '✅ GPS Autorizado'
                  : locationPermission === 'denied'
                  ? '❌ GPS Denegado - Reintentar'
                  : '🔐 Solicitar Permiso GPS'
                }
              </button>

              <button
                onClick={ping}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                🏓 Verificar Conexión
              </button>

              {trackingActive && locationPermission === 'granted' && isConnected && (
                <div className="bg-green-100 p-2 rounded text-center animate-pulse">
                  <span className="text-green-800 text-sm font-medium">
                    ✅ Enviando ubicación automáticamente cada 15 segundos
                  </span>
                </div>
              )}

              {trackingActive && locationPermission !== 'granted' && isConnected && (
                <div className="bg-yellow-100 p-2 rounded text-center">
                  <span className="text-yellow-800 text-sm font-medium">
                    ⚠️ Tracking activo - Autoriza GPS para enviar ubicaciones
                  </span>
                </div>
              )}
            </div>

            <div className="bg-green-100 p-3 rounded text-sm">
              <p className="text-green-800">
                <strong>Nota:</strong> Tu ubicación se envía automáticamente cada 15 segundos cuando el tracking está activo y el GPS autorizado.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-red-800">👨‍💼 Opciones de Administrador</h2>

          <div className="space-y-4">
            <div className="bg-yellow-100 p-3 rounded text-sm">
              <p className="text-yellow-800">
                <strong>⚠️ Advertencia:</strong> Estas opciones afectan a todos los fiscalizadores.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={toggleTrackingAdmin}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {trackingActive ? '🔴 Desactivar Tracking Global' : '🟢 Activar Tracking Global'}
              </button>

              <button
                onClick={getActiveLocations}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                📍 Ver Ubicaciones Activas (Redis)
              </button>

              <button
                onClick={getActiveLocationsFromDB}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                📍 Ver Ubicaciones (MySQL)
              </button>

              <button
                onClick={getSystemStats}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                📊 Ver Estadísticas
              </button>

              <button
                onClick={cleanupData}
                disabled={!isConnected}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                🧹 Limpiar Datos Inactivos
              </button>
            </div>
          </div>
        </div>
      </div>

      {locationPermission === 'denied' && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
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

      <div className="mb-6 p-4 bg-green-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">📡 Estado del Sistema</h3>
        <div className="space-y-1 text-sm">
          <p>• Tracking Global: <span className={`font-bold ${trackingActive ? 'text-green-600' : 'text-red-600'}`}>
            {trackingActive ? 'ACTIVADO' : 'DESACTIVADO'}
          </span></p>
          <p>• Conexión: <span className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span></p>
          <p>• GPS: <span className={`font-bold ${
            locationPermission === 'granted' ? 'text-green-600' :
            locationPermission === 'denied' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {locationPermission === 'granted' ? 'Permitido' :
             locationPermission === 'denied' ? 'Denegado' : 'Pendiente'}
          </span></p>
          <p>• Tracking Automático: <span className={`font-bold ${
            (trackingActive && locationPermission === 'granted' && isConnected) ? 'text-green-600' : 'text-gray-600'
          }`}>
            {(trackingActive && locationPermission === 'granted' && isConnected) ? 'ACTIVO ✅' : 'INACTIVO'}
          </span></p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">📨 Registro de Mensajes</h3>
          <button
            onClick={clearMessages}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            Limpiar Mensajes
          </button>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto p-4 border border-gray-200 rounded-lg">
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

      <div className="flex space-x-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};