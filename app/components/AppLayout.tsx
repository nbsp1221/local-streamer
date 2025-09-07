import { AppHeader } from '~/components/AppHeader';
import { AppSidebar } from '~/components/AppSidebar';
import { SidebarProvider } from '~/components/ui/sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  pendingCount?: number;
}

function LayoutContent({ children, searchQuery, onSearchChange, pendingCount }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AppHeader
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          pendingCount={pendingCount}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppLayout({ children, searchQuery, onSearchChange, pendingCount }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <LayoutContent
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        pendingCount={pendingCount}
      >
        {children}
      </LayoutContent>
    </SidebarProvider>
  );
}
