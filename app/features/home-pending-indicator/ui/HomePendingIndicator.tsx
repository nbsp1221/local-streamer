import { Bell } from 'lucide-react';
import { Badge } from '~/shared/ui/badge';

interface HomePendingIndicatorProps {
  pendingCount: number;
}

export function HomePendingIndicator({ pendingCount }: HomePendingIndicatorProps) {
  return (
    <div
      aria-label="Pending uploads"
      className="relative flex size-10 items-center justify-center rounded-full"
    >
      <Bell className="h-5 w-5" />
      {pendingCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center p-0 text-xs"
        >
          {pendingCount}
        </Badge>
      )}
    </div>
  );
}
