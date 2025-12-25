import { useState, useEffect } from 'react';
import { weatherApi } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import type { WeatherResponse, RuggingGuide, TempRange } from '../types';
import './Weather.css';

// Weather code to icon mapping
const getWeatherIcon = (code: number): string => {
  if (code === 0) return 'sunny';
  if (code <= 3) return 'partly-cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snowy';
  if (code <= 82) return 'rainy';
  if (code <= 86) return 'snowy';
  if (code >= 95) return 'stormy';
  return 'cloudy';
};

// Default BHS Rugging Guide matrix based on temperature and clip type
const defaultRugMatrix: RuggingGuide = {
  '15+': { unclipped: 'None', partial: '0g', fully_clipped: '50g' },
  '10-15': { unclipped: 'None', partial: '50g', fully_clipped: '100-200g' },
  '5-10': { unclipped: '0-50g', partial: '100-200g', fully_clipped: '300g' },
  '0-5': { unclipped: '50-100g', partial: '300g', fully_clipped: '300g + neck' },
  '-5-0': { unclipped: '200g', partial: '300g + neck', fully_clipped: '400g + neck' },
  'below-5': { unclipped: '300g', partial: '400g + neck', fully_clipped: '400g + neck + liner' },
};

const getTempRange = (temp: number): TempRange => {
  if (temp >= 15) return '15+';
  if (temp >= 10) return '10-15';
  if (temp >= 5) return '5-10';
  if (temp >= 0) return '0-5';
  if (temp >= -5) return '-5-0';
  return 'below-5';
};

const getTempRangeLabel = (range: string): string => {
  switch (range) {
    case '15+': return '15°C+';
    case '10-15': return '10-15°C';
    case '5-10': return '5-10°C';
    case '0-5': return '0-5°C';
    case '-5-0': return '-5 to 0°C';
    case 'below-5': return 'Below -5°C';
    default: return range;
  }
};

export default function Weather() {
  const { settings } = useSettings();
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use custom rugging guide from settings if available, otherwise use defaults
  const rugMatrix = settings?.rugging_guide || defaultRugMatrix;

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await weatherApi.getCurrent();
        setWeather(data);
        setError(null);
      } catch {
        setError('Unable to load weather');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="weather-widget weather-loading">
        <div className="weather-loading-spinner"></div>
      </div>
    );
  }

  if (error || !weather || !weather.forecast) {
    return null; // Don't show anything if weather fails or data is incomplete
  }

  const { forecast } = weather;

  // Additional safety check for required forecast properties
  if (forecast.weather_code === undefined || !forecast.overnight || !forecast.daytime) {
    return null;
  }
  const icon = getWeatherIcon(forecast.weather_code);

  // Calculate rug suggestions based on overnight minimum temperature
  const overnightMinTemp = forecast.overnight.temp_min;
  const daytimeMaxTemp = forecast.daytime.temp_max;
  const overnightRange = getTempRange(overnightMinTemp);
  const daytimeRange = getTempRange(daytimeMaxTemp);

  return (
    <div className="weather-widget">
      <div className="weather-main">
        <div className={`weather-icon weather-${icon}`}></div>
        <div className="weather-info">
          <div className="weather-desc">{forecast.weather_description}</div>
          <div className="weather-forecast">
            <div className="forecast-period">
              <span className="period-label">Overnight</span>
              <span className="period-temps">
                {Math.round(forecast.overnight.temp_min)}&deg; - {Math.round(forecast.overnight.temp_max)}&deg;C
              </span>
            </div>
            <div className="forecast-period">
              <span className="period-label">Daytime</span>
              <span className="period-temps">
                {Math.round(forecast.daytime.temp_min)}&deg; - {Math.round(forecast.daytime.temp_max)}&deg;C
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rug-suggestions">
        <h4>Rug Suggestions (<a href="https://www.bhs.org.uk/horse-care-and-welfare/health-care-management/seasonal-care/rugging/" target="_blank" rel="noopener noreferrer">BHS Guide</a>)</h4>
        <table className="rug-matrix">
          <thead>
            <tr>
              <th>Period</th>
              <th>Unclipped</th>
              <th>Partial Clip</th>
              <th>Fully Clipped</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="period-cell">
                <strong>Overnight turnout</strong>
                <span className="temp-range">{getTempRangeLabel(overnightRange)}</span>
              </td>
              <td data-label="Unclipped">{rugMatrix[overnightRange].unclipped}</td>
              <td data-label="Partial Clip">{rugMatrix[overnightRange].partial}</td>
              <td data-label="Fully Clipped">{rugMatrix[overnightRange].fully_clipped}</td>
            </tr>
            <tr>
              <td className="period-cell">
                <strong>Daytime turnout</strong>
                <span className="temp-range">{getTempRangeLabel(daytimeRange)}</span>
              </td>
              <td data-label="Unclipped">{rugMatrix[daytimeRange].unclipped}</td>
              <td data-label="Partial Clip">{rugMatrix[daytimeRange].partial}</td>
              <td data-label="Fully Clipped">{rugMatrix[daytimeRange].fully_clipped}</td>
            </tr>
          </tbody>
        </table>
        <p className="rug-note">Adjust based on individual horse needs, shelter access, and body condition.</p>
      </div>
    </div>
  );
}
