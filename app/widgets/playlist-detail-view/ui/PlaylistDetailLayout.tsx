import { cn } from '~/lib/utils';

interface PlaylistDetailLayoutProps {
  infoSlot: React.ReactNode;
  videosSlot: React.ReactNode;
  className?: string;
}

export function PlaylistDetailLayout({ infoSlot, videosSlot, className }: PlaylistDetailLayoutProps) {
  return (
    <div
      className={cn(
        'w-full px-4 pb-20 pt-10 sm:px-6 lg:px-10',
        className,
      )}
    >
      <div className="w-full max-w-[min(110rem,calc(100vw-4rem))] mx-auto">
        <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(400px,520px)_minmax(0,1fr)]">
          <div className="space-y-6">{infoSlot}</div>
          <div className="space-y-6 min-w-0">{videosSlot}</div>
        </div>
      </div>
    </div>
  );
}
