import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GraphNode as GraphNodeType, GraphModuleType as GraphModuleTypeT } from '@/db/types';
import type { RFNode } from './types';
import { resolveModuleDef } from './utils';
import { CATEGORY_PRESETS } from './constants';

export function NodeInspector({
  node,
  graphNode,
  customs,
  onClose,
  onSave,
  onDelete,
}: {
  node: RFNode;
  graphNode: GraphNodeType;
  customs: GraphModuleTypeT[];
  onClose: () => void;
  onSave: (patch: Partial<GraphNodeType>) => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(graphNode.name);
  const [description, setDescription] = useState(graphNode.description);
  const [category, setCategory] = useState(graphNode.category || '');
  const def = resolveModuleDef(graphNode.moduleKey, customs);

  useEffect(() => {
    setName(graphNode.name);
    setDescription(graphNode.description);
    setCategory(graphNode.category || '');
  }, [graphNode.id]);

  const save = async () => {
    await onSave({ name, description, category });
  };

  return (
    <div className="absolute top-3 right-14 z-20 w-72 bg-bg border-2 border-text shadow-game">
      <div className="px-3 py-2 border-b-2 border-text flex items-center justify-between">
        <span className="text-[10px] tnum text-2 font-medium">节点 · {def.label}</span>
        <button type="button" onClick={onClose} className="text-3 hover:text-text" title="关闭">
          <X className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="block text-[10px] tnum text-3 mb-1">名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            className="input-base !h-7 !text-[12px]"
          />
        </div>
        <div>
          <label className="block text-[10px] tnum text-3 mb-1">分类</label>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_PRESETS.map((p) => {
              const active = (category || '') === p.key;
              return (
                <button
                  key={p.key || 'none'}
                  type="button"
                  onClick={() => {
                    setCategory(p.key);
                    onSave({ name, description, category: p.key });
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 h-6 text-[11px] border-2 font-medium transition-all',
                    active
                      ? 'border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                      : 'border-border hover:border-text',
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 border border-text"
                    style={{ background: p.color }}
                  />
                  {p.label}
                </button>
              );
            })}
            {category && !CATEGORY_PRESETS.find((p) => p.key === category) && (
              <span className="inline-flex items-center gap-1.5 px-2 h-6 text-[11px] border-2 border-text bg-text text-bg">
                {category}
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[10px] tnum text-3 mb-1">备注</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={save}
            className="input-base !text-[12px] min-h-[60px] resize-y"
            rows={3}
          />
        </div>
        <div className="flex gap-1 pt-1">
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 btn btn-ghost btn-sm justify-center"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.5} /> 删除
          </button>
        </div>
      </div>
    </div>
  );
}