import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './globals.css';
import { seedSampleData, repairSeedCrossTypeEdges, migrateRemoveDefaultSects } from './db/seed';
import '@xyflow/react/dist/style.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// 启动期数据准备（串行，避免并发写冲突）：
//  1) seedSampleData              — 首次启动时填充示例人物/区域/旧关系
//  2) repairSeedCrossTypeEdges     — 补全因历史事务回滚丢失的跨类型示例边（人↔区域）
//     幂等：检测到已有跨类型边就跳过
//  3) migrateRemoveDefaultSects    — 清掉旧 seed 留下的默认 sect 节点（青云宗/蜀山/血魔殿）+ 相关边
//     幂等：没匹配到默认样例就直接返回
// 任一失败都不阻塞渲染，仅打印堆栈
(async () => {
  try {
    await seedSampleData();
  } catch (err: unknown) {
    console.error('[seed] failed:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
  }
  try {
    await repairSeedCrossTypeEdges();
  } catch (err: unknown) {
    console.error('[repair-cross-type-edges] failed:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
  }
  try {
    await migrateRemoveDefaultSects();
  } catch (err: unknown) {
    console.error('[migrate-remove-default-sects] failed:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
  }
})();

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);