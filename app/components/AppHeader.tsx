import { Bell, LogOut, Menu, Search, Upload, User } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { SidebarTrigger } from '~/components/ui/sidebar';
import { useAuthStore, useAuthUser } from '~/stores/auth-store';

interface AppHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  pendingCount?: number;
}

export function AppHeader({ searchQuery = '', onSearchChange, pendingCount = 0 }: AppHeaderProps) {
  const user = useAuthUser();
  const logout = useAuthStore(state => state.logout);

  const handleLogout = async () => {
    try {
      await logout();
    }
    catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between px-6 bg-background/80 backdrop-blur-sm">
      {/* Left side: Search */}
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile hamburger menu only */}
        <SidebarTrigger className="md:hidden h-10 w-10 rounded-full hover:bg-sidebar-accent transition-colors flex items-center justify-center">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>

        {/* Search bar - starts from left on desktop, after hamburger on mobile */}
        <div className="hidden md:flex flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search movies, TV series..."
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
              className="w-full pl-10 bg-card border-border rounded-full focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Upload button */}
        <Button
          asChild
          className="px-4 py-2 flex items-center gap-2 text-sm font-semibold bg-card text-card-foreground rounded-full hover:bg-muted transition-colors"
        >
          <Link to="/add-videos">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Link>
        </Button>

        {/* Notifications (placeholder for future) */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full hover:bg-sidebar-accent transition-colors"
        >
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full bg-primary overflow-hidden"
                title="Account Menu"
              >
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Account</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Mobile search bar */}
      <div className="absolute left-0 right-0 top-16 md:hidden p-4 bg-background border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search movies, TV series..."
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
            className="pl-10 bg-card border-border rounded-full"
          />
        </div>
      </div>
    </header>
  );
}
