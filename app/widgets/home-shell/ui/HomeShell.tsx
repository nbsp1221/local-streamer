import { Menu, Upload } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  type HomeNavigationItem,
  HOME_BROWSE_ITEMS,
  HOME_LIBRARY_ITEMS,
  HOME_MANAGEMENT_ITEMS,
  HOME_SETTINGS_ITEMS,
} from '~/entities/home-shell/model/home-navigation';
import { HomeAccountMenu } from '~/features/home-account-menu/ui/HomeAccountMenu';
import { HomeSearchField } from '~/features/home-search/ui/HomeSearchField';
import { Button } from '~/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/shared/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '~/shared/ui/sidebar';

interface HomeShellProps {
  children: ReactNode;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function isActiveGenre(pathname: string, search: string, genreId: string, path: string) {
  if (genreId === 'all') {
    return pathname === '/' && !search.includes('genre=');
  }

  return search.includes(`genre=${genreId}`) || pathname === path;
}

function mergeHomeSearchState(path: string, currentSearch: string) {
  const currentParams = new URLSearchParams(currentSearch);
  const targetUrl = new URL(path, 'http://localhost');
  const targetParams = new URLSearchParams(targetUrl.search);

  const query = currentParams.get('q');
  const tags = currentParams.getAll('tag');

  if (query) {
    targetParams.set('q', query);
  }

  tags.forEach(tag => targetParams.append('tag', tag));

  const nextSearch = targetParams.toString();
  return nextSearch.length > 0 ? `${targetUrl.pathname}?${nextSearch}` : targetUrl.pathname;
}

function NavigationSection({
  items,
  onNavigate,
  pathname,
  search,
  title,
}: {
  items: HomeNavigationItem[];
  onNavigate?: () => void;
  pathname: string;
  search: string;
  title: string;
}) {
  return (
    <div>
      <h3 className="mb-3 px-3 text-base font-semibold uppercase tracking-wide text-sidebar-foreground/70">
        {title}
      </h3>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = title === 'Browse'
            ? isActiveGenre(pathname, search, item.id, item.path)
            : pathname === item.path;
          const href = title === 'Browse' ? mergeHomeSearchState(item.path, search) : item.path;

          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                size="default"
                className="gap-3 px-3 py-3 text-sm font-medium"
              >
                <Link to={href} onClick={onNavigate}>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}

function HomeNavigation({
  onNavigate,
  pathname,
  search,
}: {
  onNavigate?: () => void;
  pathname: string;
  search: string;
}) {
  const homeHref = mergeHomeSearchState('/', search);

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-4">
          <Link to={homeHref} className="flex items-center gap-3" onClick={onNavigate}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <svg className="h-5 w-5 fill-current text-primary-foreground" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">Local Streamer</span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-4 space-y-6">
        <NavigationSection title="Browse" items={HOME_BROWSE_ITEMS} onNavigate={onNavigate} pathname={pathname} search={search} />
        <NavigationSection title="Library" items={HOME_LIBRARY_ITEMS} onNavigate={onNavigate} pathname={pathname} search={search} />
        <NavigationSection title="Manage" items={HOME_MANAGEMENT_ITEMS} onNavigate={onNavigate} pathname={pathname} search={search} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <NavigationSection title="Settings" items={HOME_SETTINGS_ITEMS} onNavigate={onNavigate} pathname={pathname} search={search} />
      </SidebarFooter>
    </>
  );
}

function HomeShellContent({
  children,
  searchQuery,
  onSearchChange,
}: HomeShellProps) {
  const location = useLocation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navigationDialogId = useId();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsNavigationOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar className="hidden border-r md:flex" collapsible="none">
        <HomeNavigation pathname={location.pathname} search={location.search} />
      </Sidebar>

      <div className="flex flex-1 flex-col">
        <header className="bg-background/80 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-6">
            <div className="flex flex-1 items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle sidebar menu"
                aria-controls={navigationDialogId}
                aria-expanded={isNavigationOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-sidebar-accent md:hidden"
                onClick={() => setIsNavigationOpen(true)}
                type="button"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="hidden max-w-xl flex-1 md:flex">
                <HomeSearchField
                  ariaLabel="Search library (desktop)"
                  value={searchQuery}
                  onChange={onSearchChange}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                asChild
                className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
              >
                <Link to="/add-videos">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload</span>
                </Link>
              </Button>
              <HomeAccountMenu />
            </div>
          </div>

          <div className="border-b border-border px-4 pb-4 md:hidden">
            <HomeSearchField
              ariaLabel="Search library (mobile)"
              value={searchQuery}
              onChange={onSearchChange}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <Dialog open={isNavigationOpen} onOpenChange={setIsNavigationOpen}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          aria-label="Navigation menu"
          id={navigationDialogId}
          className="left-0 top-0 h-svh max-h-svh w-[18rem] max-w-[18rem] translate-x-0 translate-y-0 rounded-none border-r p-0 md:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation menu</DialogTitle>
          </DialogHeader>
          <nav className="flex h-full flex-col">
            <HomeNavigation
              onNavigate={() => setIsNavigationOpen(false)}
              pathname={location.pathname}
              search={location.search}
            />
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HomeShell(props: HomeShellProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <HomeShellContent {...props} />
    </SidebarProvider>
  );
}
