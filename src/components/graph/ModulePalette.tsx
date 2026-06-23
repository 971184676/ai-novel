import { useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GraphModuleType as GraphModuleTypeT, GraphModuleKey } from '@/db/types';
import { BUILTIN_MODULES } from './constants';

export function ModulePalette({
  open,
  setOpen,
  customs,
  onAdd,
  onAddCustom,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  customs: GraphModuleTypeT[];
  onAdd: (key: GraphModuleKey) => void;
  onAddCustom: () => void;
}) {
  return (
    <div
      className={cn(
        'absolute top-12 sm:top-3 z-20 transition-all',
        open ? 'left-2 sm:left-3 w-52 sm:w-60' : 'left-2 sm:left-3 w-8 sm:w-9',
      )}
    >
      <div className="bg-bg border-2 border-text shadow-game">
        <div className="flex items-center justify-between px-2 h-8 sm:h-9 border-b-2 border-text">
          {open ? (
            <>
              <span className="text-[10px] tnum font-semibold tracking-wider">模块 · MODULE</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-5 h-5 inline-flex items-center justify-center text-2 hover:text-text"
                title="收起"
              >
                <ChevronLeft className="w-3 h-3" strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-5 h-5 inline-flex items-center justify-center"
              title="展开模块面板"
            >
              <ChevronRight className="w-3 h-3" strokeWidth={2} />
            </button>
          )}
        </div>
        {open && (
          <div className="p-2 space-y-2">
            <div>
              <div className="text-[10px] tnum text-2 px-1">点击下方按钮添加节点</div>
              <div className="space-y-1 mt-1">
                {BUILTIN_MODULES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onAdd(m.key)}
                    className="w-full px-2 py-1.5 flex items-center gap-2 text-[12px] border-2 border-border hover:border-text hover:shadow-[0_2px_0_0_#E5E5E5] hover:-translate-y-0.5 transition-all"
                  >
                    <span className="w-4 h-4 flex items-center justify-center text-base font-bold shrink-0">
                      {m.iconChar}
                    </span>
                    <span className="flex-1 text-left">+ {m.label}</span>
                  </button>
                ))}
                {customs.length > 0 && (
                  <>
                    <div className="text-[10px] tnum text-2 px-1 pt-1 mt-1">自定义</div>
                    {customs.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onAdd(c.key)}
                        className="w-full px-2 py-1.5 flex items-center gap-2 text-[12px] border-2 border-border hover:border-text hover:shadow-[0_2px_0_0_#E5E5E5] hover:-translate-y-0.5 transition-all"
                      >
                        <span className="w-4 h-4 flex items-center justify-center text-base font-bold shrink-0">
                          {c.icon}
                        </span>
                        <span className="flex-1 text-left">+ {c.label}</span>
                      </button>
                    ))}
                  </>
                )}
                <button
                  type="button"
                  onClick={onAddCustom}
                  className="w-full mt-1 px-2 py-1.5 flex items-center gap-2 text-[12px] border-2 border-dashed border-border hover:border-text hover:bg-surface transition-all"
                >
                  <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                  <span className="flex-1 text-left text-2">+ 管理自定义模块</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}