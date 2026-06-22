import { Plus, Circle, Diamond, Square, Triangle } from 'lucide-react';

export function EmptyState({ onAddModule }: { onAddModule: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-bg border-2 border-dashed border-text p-8 text-center pointer-events-auto shadow-game max-w-md">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Circle className="w-5 h-5" strokeWidth={1.5} />
          <Diamond className="w-5 h-5" strokeWidth={1.5} />
          <Square className="w-5 h-5" strokeWidth={1.5} />
          <Triangle className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="text-md font-semibold mb-1">空白关系网 — 三步起步</div>
        <div className="text-[12px] text-2 mb-5 leading-relaxed">
          1. <b>添加节点</b>：左侧选「人物 / 势力 / 地域 / 宗门」<br />
          2. <b>画线连接</b>：从节点边缘拖到另一个节点<br />
          3. <b>点击连线</b>：写短标签 + 详细备注，备注浮在线上
        </div>
        <button type="button" onClick={onAddModule} className="btn btn-primary btn-sm">
          <Plus className="w-3 h-3" strokeWidth={1.5} /> 打开模块面板
        </button>
      </div>
    </div>
  );
}