import { Search } from 'lucide-react';
import { Input } from '~/shared/ui/input';

interface HomeSearchFieldProps {
  ariaLabel?: string;
  value: string;
  onChange: (query: string) => void;
}

export function HomeSearchField({ ariaLabel, value, onChange }: HomeSearchFieldProps) {
  return (
    <div className="relative w-full">
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={ariaLabel}
        type="search"
        placeholder="Search movies, TV series..."
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-full border-border bg-card pl-10 focus:ring-primary"
      />
    </div>
  );
}
