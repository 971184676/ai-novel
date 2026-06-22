import { useState } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import type { GraphModuleType as GraphModuleTypeT } from '@/db/types';
import { BUILTIN_MODULES } from './constants';

export function TypeManagerDialog({
  customs,
  onAdd,
  onDelete,
  onClose,
}: {
  customs: GraphModuleTypeT[];
  onAdd: (cfg: { key: string; label: string; icon: string; color: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ key: '', label: '', icon: '◆', color: '#000000' });

  const startAdd = () => {
    setDraft({ key: `custom-${Date.now()}`, label: '', icon: '◆', color: '#000000' });
    setEditing(true);
  };

  const save = async () => {
    if (!draft.label.trim()) return;
    await onAdd(draft);
    setEditing(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-bg/80 flex items-center justify-center p-6">
      <div className="bg-bg border-2 border-text shadow-game w-[480px] max-w-full">
        <div className="flex items-center justify-between px-4 h-10 border-b-2 border-text">
          <span className="text-[12px] tnum font-semibold">自定义模块类型</span>
          <button type="button" onClick={onClose} className="text-3 hover:text-text">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10px] tnum text-2 mb-2 font-medium">内置（不可改）</div>
            <div className="grid grid-cols-2 gap-1.5">
              {BUILTIN_MODULES.map((m) => (
                <div
                  key={m.key}
                  className="px-2 py-1.5 flex items-center gap-2 text-[11px] border-2 border-border bg-surface"
                >
                  <span className="w-4 h-4 flex items-center justify-center text-base font-bold">
                    {m.iconChar}
                  </span>
                  <span className="flex-1">{m.label}</span>
                  <span className="text-[9px] text-3 tnum">内置</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tnum text-2 font-medium">自定义</span>
              {!editing && (
                <button
                  type="button"
                  onClick={startAdd}
                  className="text-[10px] tnum text-text hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" strokeWidth={2} /> 新增
                </button>
              )}
            </div>

            {editing && (
              <div className="p-3 border-2 border-text shadow-[0_2px_0_0_#000] bg-bg space-y-2 mb-2">
                <div className="text-[10px] tnum text-2 font-medium">新增自定义模块</div>
                <div>
                  <label className="block text-[10px] tnum text-3 mb-1">名称</label>
                  <input
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="如：战场、渡口、关隘、灵兽、遗迹"
                    className="input-base !h-7 !text-[12px]"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] tnum text-3 mb-1">图标</label>
                    <input
                      value={draft.icon}
                      onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                      className="input-base !h-7 !text-[12px] text-center font-bold"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tnum text-3 mb-1">颜色</label>
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                      className="w-full h-7 border-2 border-text p-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={save}
                    disabled={!draft.label.trim()}
                    className="btn btn-primary btn-sm flex-1 justify-center"
                  >
                    <Check className="w-3 h-3" strokeWidth={2} /> 保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn btn-ghost btn-sm flex-1 justify-center"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {customs.length === 0 && !editing ? (
              <div className="text-[11px] text-3 italic py-4 text-center border border-dashed border-border">
                还没有自定义模块
                <br />
                点击右上「新增」创建
              </div>
            ) : (
              <div className="space-y-1">
                {customs.map((c) => (
                  <div
                    key={c.id}
                    className="px-2 py-1.5 flex items-center gap-2 text-[11px] border-2 border-border bg-bg"
                  >
                    <span
                      className="w-5 h-5 border-2 border-text shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ color: c.color }}
                    >
                      {c.icon}
                    </span>
                    <span className="flex-1 truncate">{c.label}</span>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id!)}
                      className="text-2 hover:text-text"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}