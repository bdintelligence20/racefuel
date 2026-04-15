import { useEffect, useState, useMemo } from 'react';
import { Activity, Calendar, Mountain, ArrowRight, Loader2, X, RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StravaActivitySummary, ACTIVITY_TYPE_LABELS, formatDistance, formatDuration, formatDate } from '../../services/strava';

interface StravaActivityListProps {
  onClose: () => void;
}

type SortKey = 'date' | 'distance' | 'elevation' | 'name';
type SortDir = 'asc' | 'desc';

export function StravaActivityList({ onClose }: StravaActivityListProps) {
  const {
    strava,
    stravaActivities,
    stravaActivitiesLoading,
    fetchStravaActivities,
    importStravaActivity,
  } = useApp();

  const [importingId, setImportingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minDistance, setMinDistance] = useState(0);

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'desc');
    }
  };

  // Get unique activity types present in the data
  const availableTypes = useMemo(() => {
    const types = new Set(stravaActivities.map(a => a.type));
    return Array.from(types).sort();
  }, [stravaActivities]);

  const filteredActivities = useMemo(() => {
    let result = [...stravaActivities];

    // Activity type filter
    if (activityTypeFilter !== 'all') {
      result = result.filter(a => a.type === activityTypeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q));
    }

    // Distance filter
    if (minDistance > 0) {
      result = result.filter(a => a.distance / 1000 >= minDistance);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime();
          break;
        case 'distance':
          cmp = a.distance - b.distance;
          break;
        case 'elevation':
          cmp = a.total_elevation_gain - b.total_elevation_gain;
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [stravaActivities, activityTypeFilter, searchQuery, sortKey, sortDir, minDistance]);

  if (!strava.isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-text-secondary">Connect to Strava to import activities</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-[var(--color-border)] shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black italic text-text-primary">
              IMPORT FROM <span className="text-[#FC4C02]">STRAVA</span>
            </h2>
            <p className="text-text-secondary text-sm font-display mt-1">
              Select an activity to import
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchStravaActivities()}
              disabled={stravaActivitiesLoading}
              className="p-2 hover:bg-accent/[0.08] transition-colors"
              title="Refresh activities"
            >
              <RefreshCw className={`w-4 h-4 text-text-secondary ${stravaActivitiesLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent/[0.08] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-surfaceHighlight space-y-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-[var(--color-border)] text-text-primary text-xs font-display p-2.5 pl-8 focus:outline-none focus:border-[#FC4C02] transition-colors placeholder:text-text-muted"
            />
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
          </div>

          {/* Activity Type Filter */}
          {availableTypes.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-text-muted uppercase">Type:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setActivityTypeFilter('all')}
                  className={`px-2 py-0.5 text-[10px] font-display transition-colors ${
                    activityTypeFilter === 'all'
                      ? 'bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/50'
                      : 'bg-surfaceHighlight text-text-muted border border-transparent hover:bg-accent/[0.08]'
                  }`}
                >
                  All
                </button>
                {availableTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setActivityTypeFilter(type)}
                    className={`px-2 py-0.5 text-[10px] font-display transition-colors ${
                      activityTypeFilter === type
                        ? 'bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/50'
                        : 'bg-surfaceHighlight text-text-muted border border-transparent hover:bg-accent/[0.08]'
                    }`}
                  >
                    {ACTIVITY_TYPE_LABELS[type] || type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters Row */}
          <div className="flex items-center gap-3">
            {/* Min Distance */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted uppercase">Min km:</span>
              <div className="flex gap-1">
                {[0, 20, 50, 100].map(d => (
                  <button
                    key={d}
                    onClick={() => setMinDistance(d)}
                    className={`px-2 py-0.5 text-[10px] font-display transition-colors ${
                      minDistance === d
                        ? 'bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/50'
                        : 'bg-surfaceHighlight text-text-muted border border-transparent hover:bg-accent/[0.08]'
                    }`}
                  >
                    {d === 0 ? 'Any' : `${d}+`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* Sort */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-text-muted" />
              {(['date', 'distance', 'elevation', 'name'] as SortKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`px-2 py-0.5 text-[10px] font-display uppercase transition-colors ${
                    sortKey === key
                      ? 'bg-accent/[0.08] text-text-primary border border-[var(--color-border)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {key}
                  {sortKey === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto p-4">
          {stravaActivitiesLoading && stravaActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FC4C02] animate-spin mb-4" />
              <p className="text-text-secondary font-display text-sm">Loading activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">
                {stravaActivities.length === 0 ? 'No activities found' : 'No matching activities'}
              </p>
              <p className="text-text-muted text-sm mt-1">
                {stravaActivities.length === 0 ? 'Record an activity and come back!' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="group p-4 bg-surfaceHighlight border border-[var(--color-border)] hover:border-[#FC4C02]/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text-primary truncate group-hover:text-[#FC4C02] transition-colors">
                          {activity.name}
                        </h3>
                        <span className="text-[9px] font-display uppercase px-1.5 py-0.5 bg-surfaceHighlight border border-[var(--color-border)] text-text-muted flex-shrink-0">
                          {ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary font-display flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(activity.start_date_local)}
                        </span>
                        <span className="text-text-primary font-bold">{formatDistance(activity.distance)}</span>
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
                      className="ml-4 px-4 py-2 bg-[#FC4C02]/10 border border-[#FC4C02]/50 text-[#FC4C02] font-bold uppercase text-xs tracking-wider hover:bg-[#FC4C02] hover:text-text-primary transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
        <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-text-muted font-display">
          <span>
            {strava.athlete && `${strava.athlete.firstname} ${strava.athlete.lastname}`}
          </span>
          <span>
            {filteredActivities.length}
            {filteredActivities.length !== stravaActivities.length && ` / ${stravaActivities.length}`}
            {' '}activities
          </span>
        </div>
      </div>
    </div>
  );
}
