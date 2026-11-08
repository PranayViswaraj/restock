import React from 'react';

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** A card-shaped loading placeholder. */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`card ${className}`} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}
