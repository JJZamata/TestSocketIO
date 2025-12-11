import axios from 'axios';

const API_BASE_URL = 'https://backfiscamotov2.onrender.com/api';

export interface TrackingStats {
  active: boolean;
  totalActive: number;
  online: number;
  totalLocations: number;
  activeUsers24h: number;
  logInterval: number;
}

export interface Location {
  userId: string;
  username?: string;
  email?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  online: boolean;
  lastUpdate?: string;
}

export interface LocationHistory {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const trackingService = {
  // Obtener estadísticas del tracking
  async getStats(): Promise<TrackingStats> {
    try {
      const response = await axios.get(`${API_BASE_URL}/tracking/stats`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  },

  // Obtener todas las ubicaciones activas
  async getAllLocations(): Promise<Location[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/locations`);
      return response.data.data.locations;
    } catch (error) {
      console.error('Error obteniendo ubicaciones:', error);
      throw error;
    }
  },

  // Obtener ubicación de un usuario específico
  async getUserLocation(userId: string): Promise<Location> {
    try {
      const response = await axios.get(`${API_BASE_URL}/locations/user/${userId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error obteniendo ubicación del usuario ${userId}:`, error);
      throw error;
    }
  },

  // Obtener historial de ubicaciones de un usuario
  async getHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<PaginatedResponse<LocationHistory>> {
    try {
      const params = new URLSearchParams({
        limit: (options.limit || 100).toString(),
        offset: (options.offset || 0).toString(),
      });

      if (options.startDate) {
        params.append('startDate', options.startDate);
      }
      if (options.endDate) {
        params.append('endDate', options.endDate);
      }

      const response = await axios.get(
        `${API_BASE_URL}/locations/history/${userId}?${params}`
      );
      return response.data.data;
    } catch (error) {
      console.error(`Error obteniendo historial del usuario ${userId}:`, error);
      throw error;
    }
  },

  // Limpiar ubicaciones antiguas
  async cleanup(daysToKeep: number = 7): Promise<{ message: string; deletedCount: number }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/tracking/cleanup`, {
        daysToKeep,
      });
      return response.data.data;
    } catch (error) {
      console.error('Error limpiando datos:', error);
      throw error;
    }
  },
};