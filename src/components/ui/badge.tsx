import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'positive' | 'negative' | 'neutral' | 'mixed' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'border-transparent bg-primary text-primary-foreground': variant === 'default',
          'border-transparent bg-positive text-white': variant === 'positive',
          'border-transparent bg-destructive text-white': variant === 'negative',
          'border-transparent bg-teal text-white': variant === 'neutral',
          'border-transparent bg-gold text-primary': variant === 'mixed',
          'border-border text-foreground': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
