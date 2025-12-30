import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { SiteSettings } from '../types';
import { settingsApi, uploadsApi } from '../services/api';

interface SettingsContextType {
  settings: SiteSettings | null;
  isLoading: boolean;
  venueName: string;
  refreshSettings: () => Promise<void>;
  applyThemePreview: (settings: Partial<SiteSettings>) => void;
}

const defaultSettings: SiteSettings = {
  id: 0,
  venue_name: 'Equestrian Venue Manager',
  theme_mode: 'auto',
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
function applyTheme(settings: SiteSettings | null, isInitialLoad = false) {
  const root = document.documentElement;

  // Disable transitions during initial load to prevent flash
  if (isInitialLoad) {
    document.body.classList.add('no-transitions');
  }

  // Determine if we're in dark mode
  // Default to 'auto' (system preference) if not explicitly set
  const themeMode = settings?.theme_mode || 'auto';
  let isDarkMode = false;
  if (themeMode === 'dark') {
    isDarkMode = true;
  } else if (themeMode === 'auto') {
    isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  // 'light' mode: isDarkMode stays false

  // Apply theme mode classes
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
  }

  // Re-enable transitions after a brief delay (allows initial paint to complete)
  if (isInitialLoad) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove('no-transitions');
      });
    });
  }

  // Apply colors based on current mode
  if (isDarkMode) {
    // Dark mode colors
    const primaryColor = settings?.theme_primary_color_dark || '#60A5FA';
    const accentColor = settings?.theme_accent_color_dark || '#34D399';
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-hover', adjustColor(primaryColor, 20)); // Lighter for dark mode
    root.style.setProperty('--color-success', accentColor);
  } else {
    // Light mode colors
    const primaryColor = settings?.theme_primary_color || '#3B82F6';
    const accentColor = settings?.theme_accent_color || '#10B981';
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-hover', adjustColor(primaryColor, -20)); // Darker for light mode
    root.style.setProperty('--color-success', accentColor);
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
  const isFirstLoad = useRef(true);

  const loadSettings = useCallback(async () => {
    const isInitialLoad = isFirstLoad.current;
    isFirstLoad.current = false;

    try {
      const data = await settingsApi.get();
      setSettings(data);
      applyTheme(data, isInitialLoad);
      setFavicon(data.logo_url);
    } catch {
      // Use default settings if API fails
      setSettings(defaultSettings);
      applyTheme(defaultSettings, isInitialLoad);
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

  // Apply theme preview without saving - for instant visual feedback
  const applyThemePreview = (previewSettings: Partial<SiteSettings>) => {
    const mergedSettings = { ...settings, ...previewSettings } as SiteSettings;
    applyTheme(mergedSettings);
  };

  const venueName = settings?.venue_name || 'Equestrian Venue Manager';

  return (
    <SettingsContext.Provider value={{ settings, isLoading, venueName, refreshSettings, applyThemePreview }}>
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
