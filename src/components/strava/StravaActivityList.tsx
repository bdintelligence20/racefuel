import React, { useEffect, useState } from 'react';
import { Activity, Calendar, Mountain, ArrowRight, Loader2, X, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StravaActivitySummary, formatDistance, formatDuration, formatDate } from '../../services/strava';

interface StravaActivityListProps {
  onClose: () => void;
}

export function StravaActivityList({ onClose }: StravaActivityListProps) {
  const {
    strava,
    stravaActivities,
    stravaActivitiesLoading,
    fetchStravaActivities,
    importStravaActivity,
  } = useApp();

  const [importingId, setImportingId] = useState<number | null>(null);

  useEffect(() => {
    if (strava.isConnected && stravaActivities.length === 0) {
      fetchStravaActivities();
    }
  }, [strava.isConnected, stravaActivities.length, fetchStravaActivities]);

  const handleImport = async (activity: StravaActivitySummary) => {
    setImportingId(activity.id);
    try {
      await importStravaActivity(activity);
      onClose();
    } catch (error) {
      console.error('Failed to import activity:', error);
    } finally {
      setImportingId(null);
    }
  };

  if (!strava.isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-text-secondary">Connect to Strava to import activities</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-white/10 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black italic text-white">
              IMPORT FROM <span className="text-[#FC4C02]">STRAVA</span>
            </h2>
            <p className="text-text-secondary text-sm font-mono mt-1">
              Select a recent ride to import
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchStravaActivities()}
              disabled={stravaActivitiesLoading}
              className="p-2 hover:bg-white/10 transition-colors"
              title="Refresh activities"
            >
              <RefreshCw className={`w-4 h-4 text-text-secondary ${stravaActivitiesLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto p-4">
          {stravaActivitiesLoading && stravaActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FC4C02] animate-spin mb-4" />
              <p className="text-text-secondary font-mono text-sm">Loading activities...</p>
            </div>
          ) : stravaActivities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">No cycling activities found</p>
              <p className="text-text-muted text-sm mt-1">Go for a ride and come back!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stravaActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="group p-4 bg-black/40 border border-white/5 hover:border-[#FC4C02]/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate group-hover:text-[#FC4C02] transition-colors">
                        {activity.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(activity.start_date_local)}
                        </span>
                        <span>{formatDistance(activity.distance)}</span>
                        <span className="flex items-center gap-1">
                          <Mountain className="w-3 h-3" />
                          {Math.round(activity.total_elevation_gain)}m
                        </span>
                        <span>{formatDuration(activity.moving_time)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(activity)}
                      disabled={importingId !== null}
                      className="ml-4 px-4 py-2 bg-[#FC4C02]/10 border border-[#FC4C02]/50 text-[#FC4C02] font-bold uppercase text-xs tracking-wider hover:bg-[#FC4C02] hover:text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importingId === activity.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          IMPORTING
                        </>
                      ) : (
                        <>
                          IMPORT
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {strava.athlete && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-text-muted font-mono">
            <span>
              Connected as {strava.athlete.firstname} {strava.athlete.lastname}
            </span>
            <span>{stravaActivities.length} activities</span>
          </div>
        )}
      </div>
    </div>
  );
}
