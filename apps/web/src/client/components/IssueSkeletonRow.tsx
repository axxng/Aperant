import { memo } from 'react';

export const IssueSkeletonRow = memo(function IssueSkeletonRow() {
  return (
    <div className="h-11 flex items-center gap-3 px-4 border-b border-border animate-pulse">
      {/* issue number placeholder */}
      <div className="h-3 w-10 rounded bg-muted flex-shrink-0" />
      {/* title placeholder */}
      <div className="h-3 flex-1 rounded bg-muted" />
      {/* label dots placeholder */}
      <div className="flex gap-1 flex-shrink-0">
        <div className="h-2 w-2 rounded-full bg-muted" />
        <div className="h-2 w-2 rounded-full bg-muted" />
      </div>
      {/* avatar placeholder */}
      <div className="h-5 w-5 rounded-full bg-muted flex-shrink-0" />
      {/* state badge placeholder */}
      <div className="h-4 w-12 rounded bg-muted flex-shrink-0" />
    </div>
  );
});
