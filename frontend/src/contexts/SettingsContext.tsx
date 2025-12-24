import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { SiteSettings } from '../types';
import { settingsApi, uploadsApi } from '../services/api';

interface SettingsContextType {
  settings: SiteSettings | null;
  isLoading: boolean;
  venueName: string;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
  id: 0,
  venue_name: 'Equestrian Venue Manager',
};

// Font family imports for Google Fonts
const GOOGLE_FONTS: Record<string, string> = {
  'Roboto': 'Roboto:wght@400;500;600;700',
  'Open Sans': 'Open+Sans:wght@400;500;600;700',
  'Lato': 'Lato:wght@400;700',
  'Source Sans Pro': 'Source+Sans+3:wght@400;500;600;700',
  'Nunito': 'Nunito:wght@400;500;600;700',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Apply theme to document
function applyTheme(settings: SiteSettings | null) {
  const root = document.documentElement;

  // Apply colors
  if (settings?.theme_primary_color) {
    root.style.setProperty('--color-primary', settings.theme_primary_color);
    // Generate hover color (slightly darker)
    const hoverColor = adjustColor(settings.theme_primary_color, -20);
    root.style.setProperty('--color-primary-hover', hoverColor);
  }

  if (settings?.theme_accent_color) {
    root.style.setProperty('--color-success', settings.theme_accent_color);
  }

  // Apply font family
  if (settings?.theme_font_family && settings.theme_font_family !== 'Inter') {
    // Load Google Font if needed
    const fontFamily = settings.theme_font_family;
    if (GOOGLE_FONTS[fontFamily]) {
      loadGoogleFont(fontFamily);
    }
    root.style.setProperty('--font-family', `"${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`);
  } else {
    root.style.setProperty('--font-family', 'Inter, -apple-system, BlinkMacSystemFont, sans-serif');
  }

  // Apply theme mode
  if (settings?.theme_mode === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
  } else if (settings?.theme_mode === 'auto') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('dark-mode', prefersDark);
    document.body.classList.toggle('light-mode', !prefersDark);
  } else {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
  }
}

// Adjust hex color brightness
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Load Google Font dynamically
function loadGoogleFont(fontFamily: string) {
  const fontId = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
  if (!document.getElementById(fontId) && GOOGLE_FONTS[fontFamily]) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[fontFamily]}&display=swap`;
    document.head.appendChild(link);
  }
}

// Set favicon dynamically from logo
function setFavicon(logoUrl: string | undefined) {
  if (!logoUrl) return;

  const faviconUrl = uploadsApi.getFileUrl(logoUrl);

  // Update or create favicon link
  let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    document.head.appendChild(faviconLink);
  }
  faviconLink.href = faviconUrl;

  // Also update apple-touch-icon
  let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
  if (!appleTouchIcon) {
    appleTouchIcon = document.createElement('link');
    appleTouchIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleTouchIcon);
  }
  appleTouchIcon.href = faviconUrl;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
      applyTheme(data);
      setFavicon(data.logo_url);
    } catch {
      // Use default settings if API fails
      setSettings(defaultSettings);
      applyTheme(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (settings?.theme_mode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme(settings);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings]);

  const refreshSettings = async () => {
    await loadSettings();
  };

  const venueName = settings?.venue_name || 'Equestrian Venue Manager';

  return (
    <SettingsContext.Provider value={{ settings, isLoading, venueName, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
