import { cn } from '@/lib/utils';

type LoadingSkeletonVariant = 'card' | 'list' | 'dashboard' | 'table' | 'page';

interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
  count?: number;
  className?: string;
}

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={cn('animate-shimmer rounded-md', className)} />
);

export function LoadingSkeleton({
  variant = 'card',
  count = 1,
  className,
}: LoadingSkeletonProps) {
  const safeCount = Math.max(1, count);

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: safeCount }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-3/5" />
              <SkeletonBlock className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        {Array.from({ length: safeCount }).map((_, index) => (
          <div key={index} className="grid grid-cols-3 gap-4">
            <SkeletonBlock className="h-3 w-5/6" />
            <SkeletonBlock className="h-3 w-4/6" />
            <SkeletonBlock className="h-3 w-3/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-8', className)}>
        <div className="space-y-4 text-center">
          <SkeletonBlock className="h-8 w-56 mx-auto" />
          <SkeletonBlock className="h-4 w-80 mx-auto" />
        </div>

        <div className="rounded-xl border border-border/50 p-6 shadow-soft">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-2 w-full mt-4" />
        </div>

        <div className="rounded-2xl border-2 border-dashed border-border/60 p-12">
          <SkeletonBlock className="h-16 w-16 mx-auto rounded-2xl" />
          <SkeletonBlock className="h-4 w-64 mx-auto mt-6" />
          <SkeletonBlock className="h-4 w-40 mx-auto mt-2" />
          <SkeletonBlock className="h-10 w-44 mx-auto mt-6" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border/50 p-5 shadow-soft space-y-3">
              <SkeletonBlock className="h-5 w-24" />
              <SkeletonBlock className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={cn('space-y-10', className)}>
        <div className="space-y-4">
          <SkeletonBlock className="h-10 w-2/5" />
          <SkeletonBlock className="h-4 w-3/5" />
        </div>
        {Array.from({ length: safeCount }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/50 p-8 shadow-soft space-y-4">
            <SkeletonBlock className="h-6 w-2/6" />
            <SkeletonBlock className="h-4 w-5/6" />
            <SkeletonBlock className="h-4 w-4/6" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: safeCount }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border/50 p-6 shadow-soft space-y-4">
          <SkeletonBlock className="h-10 w-10 rounded-lg" />
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}
