import { BookOpen, Camera, Clapperboard, Film, Home, Menu, Monitor, Settings, Upload, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '~/components/ui/sidebar';

// Genre categories
const GENRE_CATEGORIES = [
  {
    id: 'all',
    label: 'All Videos',
    icon: Home,
    path: '/',
  },
  {
    id: 'movie',
    label: 'Movies',
    icon: Film,
    path: '/?genre=movie',
  },
  {
    id: 'drama',
    label: 'Drama Series',
    icon: Monitor,
    path: '/?genre=drama',
  },
  {
    id: 'animation',
    label: 'Animation',
    icon: Zap,
    path: '/?genre=animation',
  },
  {
    id: 'documentary',
    label: 'Documentary',
    icon: BookOpen,
    path: '/?genre=documentary',
  },
  {
    id: 'variety',
    label: 'Variety Show',
    icon: Clapperboard,
    path: '/?genre=variety',
  },
  {
    id: 'other',
    label: 'Other',
    icon: Camera,
    path: '/?genre=other',
  },
];

const MANAGEMENT_ITEMS = [
  {
    id: 'upload',
    label: 'Upload Videos',
    icon: Upload,
    path: '/add-videos',
  },
];

const SETTINGS_ITEMS = [
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { isMobile } = useSidebar();

  const isActiveGenre = (genreId: string, path: string) => {
    if (genreId === 'all') {
      return location.pathname === '/' && !location.search.includes('genre=');
    }
    return location.search.includes(`genre=${genreId}`) || location.pathname === path;
  };

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <Sidebar className="border-r" collapsible={isMobile ? 'offcanvas' : 'none'}>
      {/* Header: Logo always visible, hamburger only on mobile */}
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-4">
          {/* Hamburger menu - only on mobile */}
          {isMobile && (
            <SidebarTrigger className="h-10 w-10 rounded-full hover:bg-sidebar-accent transition-colors flex items-center justify-center">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
          )}

          {/* Logo - always visible */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg className="h-5 w-5 text-primary-foreground fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">Local Streamer</span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-4 space-y-6">
        {/* Genre Navigation */}
        <div>
          <h3 className="mb-3 px-3 text-base font-semibold text-sidebar-foreground/70 uppercase tracking-wide">
            Browse
          </h3>
          <SidebarMenu>
            {GENRE_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = isActiveGenre(category.id, category.path);

              return (
                <SidebarMenuItem key={category.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    size="default"
                    className="gap-3 px-3 py-3 text-sm font-medium"
                  >
                    <Link to={category.path}>
                      <Icon className="h-5 w-5" />
                      <span>{category.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        {/* Management Section */}
        <div>
          <h3 className="mb-3 px-3 text-base font-semibold text-sidebar-foreground/70 uppercase tracking-wide">
            Manage
          </h3>
          <SidebarMenu>
            {MANAGEMENT_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    size="default"
                    className="gap-3 px-3 py-3 text-sm font-medium"
                  >
                    <Link to={item.path}>
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          {SETTINGS_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  size="default"
                  className="gap-3 px-3 py-3 text-sm font-medium"
                >
                  <Link to={item.path}>
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
