import { Link } from "react-router";
import { Search, Upload } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface NavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pendingCount?: number;
}

export function NavBar({ searchQuery, onSearchChange, pendingCount = 0 }: NavBarProps) {
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

          {/* 동영상 추가 아이콘 */}
          <div className="flex items-center">
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