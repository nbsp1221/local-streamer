import { Link } from "react-router";
import { Search, Upload, LogOut, User } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useAuthUser, useAuthStore } from "~/stores/auth-store";

interface NavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pendingCount?: number;
}

export function NavBar({ searchQuery, onSearchChange, pendingCount = 0 }: NavBarProps) {
  const user = useAuthUser();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 로고 */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Local Streamer</h1>
          </Link>

          {/* 검색창 */}
          <div className="hidden md:flex flex-1 justify-center px-8">
            <div className="w-full max-w-lg relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="제목, 태그로 검색..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 오른쪽 메뉴 */}
          <div className="flex items-center space-x-2">
            {/* 동영상 추가 아이콘 */}
            <Link to="/add-videos">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
              >
                <Upload className="h-5 w-5" />
                {pendingCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* 사용자 정보 및 로그아웃 */}
            {user && (
              <>
                <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 모바일 검색창 */}
        <div className="md:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="제목, 태그로 검색..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}