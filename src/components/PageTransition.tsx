import { type ReactNode } from 'react';
import { usePageTransition } from '@/hooks/usePageTransition';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export const PageTransition = ({ children, className }: PageTransitionProps) => {
  const isTransitioning = usePageTransition();

  return (
    <div
      className={cn(
        'transition-opacity duration-300',
        isTransitioning ? 'opacity-0' : 'opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
};
