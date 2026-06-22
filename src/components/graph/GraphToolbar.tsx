import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

export function Toolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}) {
  return (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-bg border-2 border-text shadow-game p-1">
      <button
        type="button"
        title="放大"
        onClick={onZoomIn}
        className="w-7 h-7 inline-flex items-center justify-center hover:bg-surface"
      >
        <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        title="缩小"
        onClick={onZoomOut}
        className="w-7 h-7 inline-flex items-center justify-center hover:bg-surface"
      >
        <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        title="重置视角"
        onClick={onFitView}
        className="w-7 h-7 inline-flex items-center justify-center hover:bg-surface"
      >
        <Maximize className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}