export interface WeatherForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  weatherCode: number;
  description: string;
}

// WMO Weather Code descriptions
const weatherCodeMap: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

export function getWeatherDescription(code: number): string {
  return weatherCodeMap[code] || 'Unknown';
}

export function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌧️';
  return '⛈️';
}

export async function getWeatherForecast(
  lat: number,
  lng: number,
  days = 7
): Promise<WeatherForecast[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_probability_max,weather_code&timezone=auto&forecast_days=${Math.min(days, 16)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const daily = data.daily;

  const forecasts: WeatherForecast[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    forecasts.push({
      date: daily.time[i],
      tempMax: daily.temperature_2m_max[i],
      tempMin: daily.temperature_2m_min[i],
      humidity: daily.relative_humidity_2m_mean?.[i] ?? 50,
      windSpeed: daily.wind_speed_10m_max[i],
      precipitationProbability: daily.precipitation_probability_max[i],
      weatherCode: daily.weather_code[i],
      description: getWeatherDescription(daily.weather_code[i]),
    });
  }

  return forecasts;
}

// ── Race-day weather ──────────────────────────────────────────────────
// A goal race can be up to a year out, but Open-Meteo's forecast only
// reaches ~16 days. Beyond that the honest answer is "typical conditions",
// averaged from the same calendar window across recent years (Open-Meteo's
// historical archive). Within 16 days we switch to the real forecast.

export interface RaceWeather {
  source: 'forecast' | 'typical';
  tempMax: number;
  tempMin: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  weatherCode?: number;
  description?: string;
  /** How many past years were averaged (source === 'typical'). */
  yearsAveraged?: number;
}

function avg(nums: number[]): number {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : NaN;
}

/**
 * Typical conditions for a location + calendar date, averaged over the same
 * ±3-day window across the last 3 completed years (archive lags ~5 days, so
 * we never ask for dates too recent to exist).
 */
export async function getHistoricalWeatherAverage(
  lat: number,
  lng: number,
  month: number,
  day: number,
): Promise<RaceWeather> {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear - 2, thisYear - 3];

  const tempMax: number[] = [];
  const tempMin: number[] = [];
  const humidity: number[] = [];
  const wind: number[] = [];
  const wetDayFlags: number[] = [];

  await Promise.all(
    years.map(async (year) => {
      const center = new Date(year, month - 1, Math.min(day, 28));
      const start = new Date(center.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
      const end = new Date(center.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
      const url =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
        `&start_date=${start}&end_date=${end}` +
        `&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum&timezone=auto`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const d = data.daily;
        if (!d?.time) return;
        for (let i = 0; i < d.time.length; i++) {
          tempMax.push(d.temperature_2m_max?.[i]);
          tempMin.push(d.temperature_2m_min?.[i]);
          humidity.push(d.relative_humidity_2m_mean?.[i]);
          wind.push(d.wind_speed_10m_max?.[i]);
          wetDayFlags.push((d.precipitation_sum?.[i] ?? 0) >= 1 ? 1 : 0);
        }
      } catch {
        // One year failing just means fewer samples — the average still holds.
      }
    }),
  );

  // Each year's window is 7 days, so sample count / 7 ≈ years that returned data.
  const yearsAveraged = Math.min(3, Math.max(1, Math.round(tempMax.length / 7)));

  return {
    source: 'typical',
    tempMax: Math.round(avg(tempMax)),
    tempMin: Math.round(avg(tempMin)),
    humidity: Math.round(avg(humidity)),
    windSpeed: Math.round(avg(wind)),
    precipitationProbability: Math.round(avg(wetDayFlags) * 100),
    yearsAveraged,
  };
}

/**
 * Race-day weather for a date that may be anywhere in the next year: live
 * forecast if the race is within the 16-day window, otherwise the historical
 * "typical" average for that location + calendar date.
 */
export async function getRaceWeather(lat: number, lng: number, isoDate: string): Promise<RaceWeather> {
  const target = new Date(isoDate);
  const daysUntil = Math.round((target.getTime() - Date.now()) / 86_400_000);

  if (daysUntil >= 0 && daysUntil <= 16) {
    const forecasts = await getWeatherForecast(lat, lng, 16);
    const match = forecasts.find((f) => f.date === isoDate) ?? forecasts[forecasts.length - 1];
    if (match) {
      return {
        source: 'forecast',
        tempMax: Math.round(match.tempMax),
        tempMin: Math.round(match.tempMin),
        humidity: Math.round(match.humidity),
        windSpeed: Math.round(match.windSpeed),
        precipitationProbability: Math.round(match.precipitationProbability),
        weatherCode: match.weatherCode,
        description: match.description,
      };
    }
  }

  return getHistoricalWeatherAverage(lat, lng, target.getMonth() + 1, target.getDate());
}
