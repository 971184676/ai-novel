import { useState } from 'react';
import { Plus, Edit3, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GraphCanvas as GraphCanvasT } from '@/db/types';

export function CanvasSwitcher({
  canvases,
  currentCanvasId,
  onSwitch,
  onAdd,
  onRename,
  onDelete,
}: {
  canvases: GraphCanvasT[];
  currentCanvasId: number | null;
  onSwitch: (id: number) => void;
  onAdd: (name: string) => Promise<number | undefined>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const beginEdit = (c: GraphCanvasT) => {
    setEditingId(c.id!);
    setEditingName(c.name);
  };
  const commitEdit = async () => {
    if (editingId == null) return;
    await onRename(editingId, editingName);
    setEditingId(null);
    setEditingName('');
  };
  const submitNew = async () => {
    const id = await onAdd(newName);
    setCreating(false);
    setNewName('');
    if (id) onSwitch(id);
  };

  return (
    <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-bg border-2 border-text shadow-game p-1 max-w-[90vw] sm:max-w-[70vw] overflow-x-auto">
      <span className="text-[10px] tnum text-2 px-1.5 shrink-0">画布</span>
      {canvases.map((c) => {
        const active = c.id === currentCanvasId;
        if (editingId === c.id) {
          return (
            <input
              key={c.id}
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') {
                  setEditingId(null);
                  setEditingName('');
                }
              }}
              className="input-base !h-7 !text-[12px] w-32"
            />
          );
        }
        return (
          <div
            key={c.id}
            className={cn(
              'group inline-flex items-center gap-1 h-7 px-2 text-[12px] border-2 bg-bg text-text transition-all duration-150 shrink-0',
              active
                ? 'border-text shadow-[0_4px_0_0_#000] -translate-y-1'
                : 'border-border hover:border-text hover:shadow-[0_3px_0_0_#000] hover:-translate-y-0.5',
            )}
          >
            <button
              type="button"
              onClick={() => onSwitch(c.id!)}
              className="inline-flex items-center gap-1"
              title={`切换到「${c.name}」`}
            >
              {c.name}
            </button>
            <button
              type="button"
              onClick={() => beginEdit(c)}
              className={cn(
                'opacity-0 group-hover:opacity-100 transition-opacity px-0.5',
                active ? 'text-2 hover:text-text' : 'text-2 hover:text-text',
              )}
              title="重命名"
            >
              <Edit3 className="w-2.5 h-2.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id!)}
              className={cn(
                'opacity-0 group-hover:opacity-100 transition-opacity px-0.5',
                active ? 'text-2 hover:text-text' : 'text-2 hover:text-text',
              )}
              title="删除画布（会同时删除画布上的全部节点和边）"
            >
              <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
      {creating ? (
        <div className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder="画布名（如：势力关系）"
            className="input-base !h-7 !text-[12px] w-44"
          />
          <button
            type="button"
            onClick={submitNew}
            className="w-7 h-7 inline-flex items-center justify-center border-2 border-text bg-bg text-text shadow-[0_3px_0_0_#000] -translate-y-0.5 active:translate-y-[2px] active:shadow-[0_1px_0_0_#000] transition-all"
            title="确认"
          >
            <Check className="w-3 h-3" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="w-7 h-7 inline-flex items-center justify-center border-2 border-border bg-bg text-text hover:border-text hover:shadow-[0_3px_0_0_#000] hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-[0_1px_0_0_#000] transition-all"
            title="取消"
          >
            <X className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 h-7 px-2 text-[12px] border-2 border-dashed border-border bg-bg text-text hover:border-text hover:bg-surface hover:shadow-[0_3px_0_0_#000] hover:-translate-y-0.5 transition-all duration-150 shrink-0"
          title="新建画布"
        >
          <Plus className="w-3 h-3" strokeWidth={2} /> 新建
        </button>
      )}
    </div>
  );
}