import { X } from 'lucide-react';
import { Badge } from '~/shared/ui/badge';
import { Button } from '~/shared/ui/button';

interface HomeTagFilterProps {
  activeTags: string[];
  onTagRemove: (tag: string) => void;
  onClearAll: () => void;
}

export function HomeTagFilter({
  activeTags,
  onTagRemove,
  onClearAll,
}: HomeTagFilterProps) {
  if (activeTags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4">
      <span className="text-sm font-medium text-muted-foreground">
        Active filters:
      </span>

      <div className="flex flex-1 flex-wrap gap-2">
        {activeTags.map(tag => (
          <Badge
            key={tag}
            variant="default"
            className="cursor-pointer px-3 py-1 transition-colors hover:bg-primary/80"
          >
            #
            {tag}
            <Button
              aria-label={`Remove #${tag} filter`}
              variant="ghost"
              size="sm"
              className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => onTagRemove(tag)}
              type="button"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <Button
        aria-label="Clear all filters"
        variant="outline"
        size="sm"
        onClick={onClearAll}
        className="whitespace-nowrap"
        type="button"
      >
        Clear all
      </Button>
    </div>
  );
}
