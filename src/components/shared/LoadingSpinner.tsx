import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  className?: string;
  size?: number;
}

export function LoadingSpinner({ fullScreen = false, className, size = 48 }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Loader2 className={cn("animate-spin text-primary", className)} size={size} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2 className="animate-spin text-primary" size={size} />
    </div>
  );
}
