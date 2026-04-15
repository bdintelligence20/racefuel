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
