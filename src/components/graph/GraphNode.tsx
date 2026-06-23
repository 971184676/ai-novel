import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { RFNode } from './types';

export function ModuleNodeView({ data, selected }: NodeProps<RFNode>) {
  const { label, iconChar, category, categoryColor: catColor } = data;
  return (
    <div
      className={cn(
        'min-w-[120px] max-w-[200px] bg-bg text-text border-2 select-none cursor-pointer transition-all',
        selected
          ? 'border-text shadow-[0_4px_0_0_#000] -translate-y-0.5'
          : 'border-text hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_#E5E5E5]',
      )}
      style={{ padding: '8px 12px 6px', borderRadius: 0 }}
    >
      <Handle id="t" type="target" position={Position.Left} className="!bg-text !border-bg !w-2 !h-2" />
      <Handle id="s" type="source" position={Position.Right} className="!bg-text !border-bg !w-2 !h-2" />
      {category && (
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 3, background: catColor }}
        />
      )}
      <div className="flex items-center gap-2">
        <span className="text-base leading-none shrink-0 font-bold" aria-hidden>
          {iconChar}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold leading-tight truncate text-text">
            {label || '未命名'}
          </div>
          {category && (
            <div
              className="text-[9px] mt-0.5 tnum tracking-wider uppercase font-medium"
              style={{ color: catColor }}
            >
              {category}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}