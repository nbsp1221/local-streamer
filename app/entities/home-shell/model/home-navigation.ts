import {
  Home,
  List,
  Settings,
  Upload,
} from 'lucide-react';

export interface HomeNavigationItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
}

export const HOME_LIBRARY_ITEMS: HomeNavigationItem[] = [
  { id: 'home', label: 'All Videos', icon: Home, path: '/' },
  { id: 'playlists', label: 'Playlists', icon: List, path: '/playlists' },
];

export const HOME_MANAGEMENT_ITEMS: HomeNavigationItem[] = [
  { id: 'upload', label: 'Upload Videos', icon: Upload, path: '/add-videos' },
];

export const HOME_SETTINGS_ITEMS: HomeNavigationItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];
