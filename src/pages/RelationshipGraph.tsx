import '@xyflow/react/dist/style.css';
import { ReactFlowProvider } from '@xyflow/react';
import { GraphInner } from '@/components/graph/GraphInner';

export default function RelationshipGraph() {
  return (
    <div className="-mx-12 -my-10 w-[calc(100%+6rem)] h-[calc(100vh-3.5rem)] bg-bg">
      <ReactFlowProvider>
        <GraphInner />
      </ReactFlowProvider>
    </div>
  );
}