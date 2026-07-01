import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { RFEdge } from './types';

export function RelationEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RFEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { label, note, style = 'solid' } = data ?? {};
  const dashArray =
    style === 'dashed' ? '6 4' : style === 'dotted' ? '2 4' : undefined;
  const strokeWidth = selected ? 3 : 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#000',
          strokeWidth,
          strokeDasharray: dashArray,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <div className="flex flex-col items-center gap-0.5">
            {label && (
              <span
                className={cn(
                  'inline-block px-1.5 py-0.5 text-[10px] bg-bg border max-w-[160px] truncate',
                  selected ? 'border-text text-text font-semibold' : 'border-border text-text',
                )}
                title={label}
              >
                {label}
              </span>
            )}
            {selected && note && (
              <span className="inline-block px-1.5 py-0.5 text-[9px] bg-bg border border-text text-text max-w-[200px] leading-snug whitespace-pre-wrap line-clamp-3">
                {note}
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const ARROW_DEFS = (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <marker
        id="arrow-head-off"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#000" />
      </marker>
      <marker
        id="arrow-head-on"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="9"
        markerHeight="9"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#000" />
      </marker>
    </defs>
  </svg>
);