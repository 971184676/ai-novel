import '@xyflow/react/dist/style.css';
import { ReactFlowProvider } from '@xyflow/react';
import { GraphInner } from '@/components/graph/GraphInner';

export default function RelationshipGraph() {
  return (
    <div className="-mx-4 -my-6 w-[calc(100%+2rem)] h-[calc(100vh-5rem)] sm:-mx-12 sm:-my-10 sm:w-[calc(100%+6rem)] sm:h-[calc(100vh-3.5rem)] bg-bg">
      <ReactFlowProvider>
        <GraphInner />
      </ReactFlowProvider>
    </div>
  );
}