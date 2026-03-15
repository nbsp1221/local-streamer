import {
  BookOpen,
  Camera,
  Clapperboard,
  Film,
  Home,
  List,
  Monitor,
  Settings,
  Upload,
  Zap,
} from 'lucide-react';

export interface HomeNavigationItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
}

export const HOME_BROWSE_ITEMS: HomeNavigationItem[] = [
  { id: 'all', label: 'All Videos', icon: Home, path: '/' },
  { id: 'movie', label: 'Movies', icon: Film, path: '/?genre=movie' },
  { id: 'drama', label: 'Drama Series', icon: Monitor, path: '/?genre=drama' },
  { id: 'animation', label: 'Animation', icon: Zap, path: '/?genre=animation' },
  { id: 'documentary', label: 'Documentary', icon: BookOpen, path: '/?genre=documentary' },
  { id: 'variety', label: 'Variety Show', icon: Clapperboard, path: '/?genre=variety' },
  { id: 'other', label: 'Other', icon: Camera, path: '/?genre=other' },
];

export const HOME_LIBRARY_ITEMS: HomeNavigationItem[] = [
  { id: 'playlists', label: 'Playlists', icon: List, path: '/playlists' },
];

export const HOME_MANAGEMENT_ITEMS: HomeNavigationItem[] = [
  { id: 'upload', label: 'Upload Videos', icon: Upload, path: '/add-videos' },
];

export const HOME_SETTINGS_ITEMS: HomeNavigationItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];
