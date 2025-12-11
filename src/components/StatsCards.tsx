import React from 'react';
import { TrackingStats } from '../services/trackingService';

interface StatsCardsProps {
  stats: TrackingStats | null;
  isTrackingActive: boolean;
  onToggleTracking: () => void;
  loading?: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  isTrackingActive,
  onToggleTracking,
  loading = false
}) => {
  const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color: 'green' | 'blue' | 'yellow' | 'purple' | 'red';
  }> = ({ title, value, subtitle, icon, color }) => {
    const colorClasses = {
      green: 'bg-green-50 text-green-700 border-green-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      red: 'bg-red-50 text-red-700 border-red-200'
    };

    return (
      <div className={`p-6 rounded-lg border-2 ${colorClasses[color]} transition-all hover:shadow-md`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs mt-1 opacity-75">{subtitle}</p>
            )}
          </div>
          <div className="text-3xl opacity-50">{icon}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Estado del Tracking"
        value={isTrackingActive ? 'ACTIVO' : 'INACTIVO'}
        icon={isTrackingActive ? '🟢' : '🔴'}
        color={isTrackingActive ? 'green' : 'red'}
      />

      <StatCard
        title="Fiscalizadores Online"
        value={stats?.online || 0}
        subtitle={`de ${stats?.totalActive || 0} activos`}
        icon="👥"
        color="blue"
      />

      <StatCard
        title="Total Registros"
        value={stats?.totalLocations?.toLocaleString() || '0'}
        subtitle="en base de datos"
        icon="📊"
        color="purple"
      />

      <StatCard
        title="Actividad 24h"
        value={stats?.activeUsers24h || 0}
        subtitle="fiscalizadores"
        icon="📈"
        color="yellow"
      />

      <div className="lg:col-span-4 flex justify-center mt-4">
        <button
          onClick={onToggleTracking}
          disabled={loading}
          className={`px-8 py-3 rounded-lg font-semibold text-white transition-all transform hover:scale-105 ${
            isTrackingActive
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
        >
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Procesando...
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span>{isTrackingActive ? '🔴' : '🟢'}</span>
              <span>
                {isTrackingActive
                  ? 'Desactivar Tracking Global'
                  : 'Activar Tracking Global'
                }
              </span>
            </div>
          )}
        </button>
      </div>

      {stats && (
        <div className="lg:col-span-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center gap-6 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Intervalo de registro:</span>
              <span>{stats.logInterval} minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Última actualización:</span>
              <span>{new Date().toLocaleString('es-PE')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsCards;