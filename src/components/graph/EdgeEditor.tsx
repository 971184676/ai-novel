import { useState, useEffect } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GraphNode as GraphNodeType, GraphEdge as GraphEdgeType, GraphModuleType as GraphModuleTypeT } from '@/db/types';
import { resolveModuleDef } from './utils';

export function EdgeEditor({
  edge,
  sourceNode,
  targetNode,
  customs,
  onSave,
  onDelete,
  onClose,
}: {
  edge: GraphEdgeType;
  sourceNode?: GraphNodeType;
  targetNode?: GraphNodeType;
  customs: GraphModuleTypeT[];
  onSave: (edgeId: number, patch: Partial<GraphEdgeType>) => Promise<void>;
  onDelete: (edgeId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(edge.label ?? '');
  const [note, setNote] = useState(edge.note ?? '');
  const [style, setStyle] = useState<'solid' | 'dashed' | 'dotted'>(edge.style);

  useEffect(() => {
    setLabel(edge.label ?? '');
    setNote(edge.note ?? '');
    setStyle(edge.style);
  }, [edge.id]);

  const srcDef = sourceNode
    ? resolveModuleDef(sourceNode.moduleKey, customs)
    : null;
  const tgtDef = targetNode
    ? resolveModuleDef(targetNode.moduleKey, customs)
    : null;

  async function save() {
    await onSave(edge.id!, {
      label: label.trim() || undefined,
      note: note.trim() || undefined,
      style,
    });
    onClose();
  }

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-[420px] max-w-[92vw] bg-bg border-2 border-text shadow-game">
      <div className="px-3 py-2 border-b-2 border-text flex items-center justify-between">
        <span className="text-[10px] tnum text-2 font-medium">连线 · 编辑</span>
        <button type="button" onClick={onClose} className="text-3 hover:text-text" title="关闭">
          <X className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="text-[11px] text-2 flex items-center gap-1.5">
          {sourceNode && (
            <>
              <span className="font-bold">{srcDef?.iconChar}</span>
              <span className="text-text">{sourceNode.name}</span>
            </>
          )}
          <span className="mx-1 text-3">→</span>
          {targetNode && (
            <>
              <span className="font-bold">{tgtDef?.iconChar}</span>
              <span className="text-text">{targetNode.name}</span>
            </>
          )}
        </div>

        <div>
          <label className="block text-[10px] tnum text-3 mb-1">
            短标签 <span className="text-2">（可选，浮在线上）</span>
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
            placeholder="如：师徒、隶属、邻国"
            className="input-base !h-8 !text-[12px]"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[10px] tnum text-3 mb-1">
            详细备注 <span className="text-2">（可选，点击边时显示）</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="关系详情，鼠标悬停或选中时显示在边上"
            className="input-base !text-[12px] min-h-[60px] resize-y"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-[10px] tnum text-3 mb-1">线型</label>
          <div className="flex gap-2">
            {(['solid', 'dashed', 'dotted'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className={cn(
                  'flex-1 h-7 inline-flex items-center justify-center text-[11px] border-2 transition-all',
                  style === s
                    ? 'border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                    : 'border-border hover:border-text',
                )}
              >
                <span
                  className="inline-block w-10"
                  style={{
                    borderTop:
                      s === 'solid'
                        ? '2px solid #000'
                        : s === 'dashed'
                        ? '2px dashed #000'
                        : '2px dotted #000',
                    height: '2px',
                    boxSizing: 'border-box',
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 pt-1">
          <button
            type="button"
            onClick={() => onDelete(edge.id!)}
            className="flex-1 btn btn-ghost btn-sm justify-center"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.5} /> 删除连线
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 btn btn-primary btn-sm justify-center"
          >
            <Check className="w-3 h-3" strokeWidth={1.5} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}