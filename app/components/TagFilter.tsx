import { X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface TagFilterProps {
  activeTags: string[];
  onTagRemove: (tag: string) => void;
  onClearAll: () => void;
}

export function TagFilter({ activeTags, onTagRemove, onClearAll }: TagFilterProps) {
  if (activeTags.length === 0) return null;

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-lg border">
      <span className="text-sm font-medium text-muted-foreground">
        활성 필터:
      </span>
      
      <div className="flex flex-wrap gap-2 flex-1">
        {activeTags.map((tag) => (
          <Badge
            key={tag}
            variant="default"
            className="px-3 py-1 cursor-pointer hover:bg-primary/80 transition-colors"
          >
            #{tag}
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => onTagRemove(tag)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onClearAll}
        className="whitespace-nowrap"
      >
        모두 지우기
      </Button>
    </div>
  );
}