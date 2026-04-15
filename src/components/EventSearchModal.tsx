import { useState, useEffect } from 'react';
import { X, Cloud, Thermometer, Wind, Droplets, Loader2, MapPin } from 'lucide-react';
import { getWeatherForecast, WeatherForecast, getWeatherEmoji } from '../services/weather/weatherService';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

interface EventSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EventSearchModal({ isOpen, onClose }: EventSearchModalProps) {
  const { routeData } = useApp();
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Auto-fetch weather when modal opens using route GPS data or geolocation
  useEffect(() => {
    if (!isOpen) return;

    const fetchWeather = async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const results = await getWeatherForecast(lat, lng, 16);
        setForecasts(results);
      } catch {
        toast.error('Failed to fetch weather');
      } finally {
        setLoading(false);
      }
    };

    // Use route start point if available
    if (routeData.gpsPath && routeData.gpsPath.length > 0) {
      const start = routeData.gpsPath[0];
      fetchWeather(start.lat, start.lng);
    } else {
      // Fall back to geolocation
      navigator.geolocation?.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Default to Cape Town
          fetchWeather(-33.9249, 18.4241);
        }
      );
    }
  }, [isOpen, routeData.gpsPath]);

  if (!isOpen) return null;

  const selectedForecast = forecasts.find((f) => f.date === selectedDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-warm uppercase tracking-wider font-bold">16-Day Forecast</div>
            <h2 className="text-lg font-bold text-text-primary">Race Day Weather</h2>
            {routeData.gpsPath && routeData.gpsPath.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                Based on route start location
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Day Detail */}
        {selectedForecast && (
          <div className="px-4 py-3 bg-warm/5 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  {new Date(selectedForecast.date).toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">{selectedForecast.description}</div>
              </div>
              <span className="text-3xl">{getWeatherEmoji(selectedForecast.weatherCode)}</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              <div className="text-center">
                <Thermometer className="w-4 h-4 text-warm mx-auto mb-1" />
                <div className="text-sm font-display font-bold text-text-primary">{Math.round(selectedForecast.tempMax)}°</div>
                <div className="text-[9px] text-text-muted">{Math.round(selectedForecast.tempMin)}° low</div>
              </div>
              <div className="text-center">
                <Droplets className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <div className="text-sm font-display font-bold text-text-primary">{selectedForecast.humidity}%</div>
                <div className="text-[9px] text-text-muted">humidity</div>
              </div>
              <div className="text-center">
                <Wind className="w-4 h-4 text-text-secondary mx-auto mb-1" />
                <div className="text-sm font-display font-bold text-text-primary">{Math.round(selectedForecast.windSpeed)}</div>
                <div className="text-[9px] text-text-muted">km/h</div>
              </div>
              <div className="text-center">
                <Cloud className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <div className="text-sm font-display font-bold text-text-primary">{selectedForecast.precipitationProbability}%</div>
                <div className="text-[9px] text-text-muted">rain</div>
              </div>
            </div>
            <p className="text-[10px] text-warm mt-2">
              Tip: {Math.round((selectedForecast.tempMax + selectedForecast.tempMin) / 2) > 25
                ? 'Hot conditions — increase hydration and sodium intake'
                : Math.round((selectedForecast.tempMax + selectedForecast.tempMin) / 2) > 15
                ? 'Moderate temps — standard nutrition plan should work well'
                : 'Cool conditions — you may need less hydration but keep carbs up'}
            </p>
          </div>
        )}

        {/* Forecast List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-warm animate-spin" />
            </div>
          ) : forecasts.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              No forecast available
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {forecasts.map((forecast) => {
                const isSelected = selectedDate === forecast.date;
                const isToday = forecast.date === new Date().toISOString().split('T')[0];

                return (
                  <button
                    key={forecast.date}
                    onClick={() => setSelectedDate(isSelected ? null : forecast.date)}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                      isSelected ? 'bg-warm/10' : 'hover:bg-surfaceHighlight'
                    }`}
                  >
                    <span className="text-xl w-8 text-center">{getWeatherEmoji(forecast.weatherCode)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text-primary">
                        {new Date(forecast.date).toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {isToday && <span className="text-accent ml-1.5 text-[9px] font-bold">TODAY</span>}
                      </div>
                      <div className="text-[10px] text-text-muted">{forecast.description}</div>
                    </div>
                    <div className="text-right text-[10px] font-display text-text-secondary">
                      <div>{Math.round(forecast.tempMin)}–{Math.round(forecast.tempMax)}°C</div>
                      <div className="text-text-muted">{forecast.humidity}% · {Math.round(forecast.windSpeed)}km/h</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
