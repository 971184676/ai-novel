import type { Node, Edge } from '@xyflow/react';
import type { Circle } from 'lucide-react';

export type BuiltInKey = 'character' | 'faction' | 'region' | 'sect';

export interface BuiltInModuleDef {
  key: BuiltInKey;
  label: string;
  iconChar: string;
  IconComponent: typeof Circle;
}

export type RFNodeData = {
  nodeId: number;
  moduleKey: string;
  label: string;
  iconChar: string;
  category: string;
  categoryColor: string;
  selected?: boolean;
  [key: string]: unknown;
};

export type RFNode = Node<RFNodeData, 'module'>;

export type RFEdgeData = {
  edgeId: number;
  label?: string;
  note?: string;
  style: 'solid' | 'dashed' | 'dotted';
  [key: string]: unknown;
};

export type RFEdge = Edge<RFEdgeData, 'relation'>;