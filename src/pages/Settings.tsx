// =============================================================================
// ai-novel · 设置页
// 路径 /settings
//   1. AI 服务配置：API URL + API Key + 测试连接
//   2. 备份与恢复：导出当前书籍 / 导出全部 / 导入 JSON / 清空所有数据
//   3. 关于 + 存储用量
// =============================================================================

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  RotateCcw,
  ServerCog,
  ShieldAlert,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  callDeepSeek,
  DeepSeekError,
  DEFAULT_API_URL,
  getApiKey,
  getApiUrl,
  hasApiKey,
  resetApiUrl,
  setApiKey,
  setApiUrl,
} from '@/ai/deepseek';
import {
  applyImport,
  BACKUP_WARN_SIZE_BYTES,
  deleteBookCascade,
  estimateDbSize,
  exportAll,
  exportBook,
  summarizeBackup,
  validateBackup,
  wipeAllData,
  type BackupBundle,
  type BackupSummary,
} from '@/db/exportImport';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToaster } from '@/hooks/useToaster';
import { formatDateTime, formatBytes } from '@/lib/utils';
import { ApiKeyTutorial } from '@/components/common/ApiKeyTutorial';

// =============================================================================
// 主页面
// =============================================================================

export default function Settings() {
  const toaster = useToaster();

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-12 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center w-8 h-8 border-2 border-text bg-bg shadow-[0_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#000] active:translate-y-[1px] active:shadow-[0_1px_0_0_#000] transition-all"
              aria-label="返回首页"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            </Link>
            <div>
              <div className="text-xs tnum text-3">SETTINGS · 设置</div>
              <div className="text-md font-semibold">应用设置</div>
            </div>
          </div>
          <Link
            to="/"
            className="text-xs text-2 hover:text-text inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={1.5} /> 返回首页
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-12 py-10 space-y-12">
        {/* 风险提示 */}
        <div className="border-2 border-text p-4 bg-surface flex items-start gap-3 shadow-[0_4px_0_0_#000]">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="text-xs leading-relaxed">
            <div className="font-semibold mb-1">请注意：</div>
            <div>
              所有数据保存在当前浏览器（IndexedDB），清除浏览器数据 = 删除全部书籍。
              请定期通过下方「导出全部数据」生成 JSON 备份；
              DeepSeek API Key 同样仅保存在 localStorage，请勿在公共电脑录入。
            </div>
          </div>
        </div>

        <ApiKeySection toaster={toaster} />
        <ApiKeyTutorial />
        <BackupSection toaster={toaster} />
        <DangerZoneSection toaster={toaster} />
        <AboutSection />
      </main>
    </div>
  );
}

// =============================================================================
// 1. AI 服务配置区（API URL + API Key + 测试连接）
// =============================================================================

function ApiKeySection({ toaster }: { toaster: ReturnType<typeof useToaster> }) {
  const [draft, setDraft] = React.useState('');
  const [saved, setSaved] = React.useState(getApiKey());
  const [urlDraft, setUrlDraft] = React.useState('');
  const [savedUrl, setSavedUrl] = React.useState(getApiUrl());
  const [showKey, setShowKey] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null);

  const onSaveKey = () => {
    const trimmed = draft.trim();
    setApiKey(trimmed);
    setSaved(trimmed);
    setDraft('');
    if (trimmed) {
      toaster.success('API Key 已保存到 localStorage');
    } else {
      toaster.success('API Key 已清空');
    }
  };

  const onClearKey = () => {
    setApiKey('');
    setSaved('');
    setDraft('');
    setTestResult(null);
    toaster.success('API Key 已清空');
  };

  const onSaveUrl = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      resetApiUrl();
      setSavedUrl(DEFAULT_API_URL);
      setUrlDraft('');
      toaster.success('API URL 已重置为默认值');
      return;
    }
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'https:') {
        toaster.error('URL 格式错误', '出于安全考虑，仅支持 HTTPS 协议');
        return;
      }
    } catch {
      toaster.error('URL 格式错误', '请输入完整的 https URL');
      return;
    }
    setApiUrl(trimmed);
    setSavedUrl(trimmed);
    setUrlDraft('');
    toaster.success('API URL 已保存');
  };

  const onResetUrl = () => {
    resetApiUrl();
    setSavedUrl(DEFAULT_API_URL);
    setUrlDraft('');
    toaster.success('已重置为默认 URL');
  };

  const onTest = async () => {
    const key = saved.trim();
    if (!key) {
      setTestResult({ ok: false, message: '请先保存 API Key' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // 用最小请求测试：4 tokens，temperature=0
      await callDeepSeek({
        apiKey: key,
        context: {
          systemPrompt: '你是一个助手。',
          userPrompt: '回复"ok"',
          // 其余 NovelContext 字段留空（测试连接用不到）
          worldSetting: '',
          characters: '',
          prevSummaries: '',
          outline: '',
        },
        maxTokens: 4,
        temperature: 0,
      });
      setTestResult({ ok: true, message: `连接成功 · ${savedUrl}` });
      toaster.success('连接成功');
    } catch (e) {
      const err = e as DeepSeekError | Error;
      const msg = err instanceof DeepSeekError ? err.message : (e as Error)?.message;
      setTestResult({ ok: false, message: msg });
      toaster.error('连接失败', msg);
    } finally {
      setTesting(false);
    }
  };

  const masked = saved ? `${saved.slice(0, 4)}${'*'.repeat(Math.max(0, saved.length - 8))}${saved.slice(-4)}` : '';
  const isCustomUrl = savedUrl !== DEFAULT_API_URL;

  return (
    <Section
      icon={<ServerCog className="w-4 h-4" strokeWidth={1.5} />}
      title="AI 服务配置"
      hint="用于章节 AI 扩写。URL 和 Key 仅保存在浏览器 localStorage，不会上传。支持任意 OpenAI 兼容协议的服务（DeepSeek / OpenAI / 自建代理等）。"
    >
      <div className="space-y-6">
        {/* === API URL === */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="api-url">API 端点 URL</Label>
              {isCustomUrl && (
                <span className="text-xs text-2 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-text inline-block" />
                  自定义
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="api-url-current"
                readOnly
                value={savedUrl}
                className="font-mono text-xs"
              />
              {isCustomUrl && (
                <Button size="sm" variant="ghost" onClick={onResetUrl} title="恢复默认 URL">
                  <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                  恢复默认
                </Button>
              )}
            </div>
            <div className="text-xs text-3 mt-1">
              默认：<span className="font-mono">{DEFAULT_API_URL}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="api-url-new">修改 URL（OpenAI 兼容 chat completions）</Label>
            <div className="flex items-center gap-2">
              <Input
                id="api-url-new"
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://your-proxy.example.com/v1/chat/completions"
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <Button size="sm" variant="primary" onClick={onSaveUrl} disabled={!urlDraft.trim()}>
                保存
              </Button>
            </div>
            <div className="text-xs text-3 mt-1 leading-relaxed">
              留空保存 = 恢复默认。可填自建代理（如 Vite dev proxy、Cloudflare Workers 等）规避浏览器 CORS。
            </div>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-border" />

        {/* === API Key === */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="api-key-current-label">当前 API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="api-key-current"
                readOnly
                value={showKey ? saved : masked}
                placeholder="（尚未配置）"
                className="font-mono"
              />
              <Button size="sm" variant="ghost" onClick={() => setShowKey((v) => !v)}>
                {showKey ? '隐藏' : '显示'}
              </Button>
              {saved && (
                <Button size="sm" variant="ghost" onClick={onClearKey}>
                  清空
                </Button>
              )}
            </div>
            <div className="text-xs text-3 mt-1">
              长度 {saved.length} · {hasApiKey() ? '已配置' : '未配置'}
            </div>
          </div>

          <div>
            <Label htmlFor="api-key-new">录入 / 覆盖</Label>
            <div className="flex items-center gap-2">
              <Input
                id="api-key-new"
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <Button size="sm" variant="primary" onClick={onSaveKey} disabled={!draft.trim()}>
                保存
              </Button>
            </div>
            <div className="text-xs text-3 mt-1 leading-relaxed">
              Key 仅保存在浏览器 localStorage，不上传。浏览器直连可能触发 CORS，建议用上面的 URL 字段配自建代理。
            </div>
          </div>
        </div>

        {/* === 测试 === */}
        <div className="pt-2 border-t border-border flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={onTest} disabled={testing || !saved}>
            {testing ? '测试中…' : '测试连接'}
          </Button>
          {testResult && (
            <div
              className={`text-xs inline-flex items-center gap-1 ${
                testResult.ok ? 'text-text' : 'text-[#333]'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
              ) : (
                <XCircle className="w-3 h-3" strokeWidth={1.5} />
              )}
              <span className="break-all">{testResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// 2. 备份与恢复区
// =============================================================================

function BackupSection({ toaster }: { toaster: ReturnType<typeof useToaster> }) {
  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];
  const [exportingId, setExportingId] = React.useState<number | null>(null);

  const handleExportBook = async (bookId: number) => {
    setExportingId(bookId);
    try {
      const r = await exportBook(bookId);
      const sizeMB = (r.size / 1024 / 1024).toFixed(2);
      const warn = r.size > BACKUP_WARN_SIZE_BYTES ? '（文件较大，建议精简）' : '';
      toaster.success(`已导出 ${r.filename}`, `${sizeMB} MB ${warn}`.trim());
    } catch (e) {
      toaster.error('导出失败', (e as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  const handleExportAll = async () => {
    setExportingId(-1);
    try {
      const r = await exportAll();
      const sizeMB = (r.size / 1024 / 1024).toFixed(2);
      const warn = r.size > BACKUP_WARN_SIZE_BYTES ? '（文件较大，建议精简）' : '';
      toaster.success(`已导出 ${r.filename}`, `${sizeMB} MB ${warn}`.trim());
    } catch (e) {
      toaster.error('导出失败', (e as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <Section
      icon={<Database className="w-4 h-4" strokeWidth={1.5} />}
      title="备份与恢复"
      hint="导出 JSON 备份可用于跨设备迁移或长期保存。建议每周备份一次。"
    >
      <div className="space-y-6">
        {/* 单书导出 */}
        <div>
          <Label>按书籍导出</Label>
          {books.length === 0 ? (
            <div className="text-xs text-3 border-2 border-text bg-bg p-3 shadow-[0_3px_0_0_#000]">
              还没有书籍可导出
            </div>
          ) : (
            <div className="list-3d">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="list-row-3d flex items-center justify-between px-4 py-3 border-b-2 border-text last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.name}</div>
                    <div className="text-xs text-3 tnum">
                      {b.genre} · 更新 {formatDateTime(b.updatedAt)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => b.id != null && handleExportBook(b.id)}
                    disabled={exportingId != null}
                  >
                    <Download className="w-3 h-3" strokeWidth={1.5} />
                    {exportingId === b.id ? '导出中…' : '导出'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 批量操作 */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <Button
            size="default"
            variant="default"
            onClick={handleExportAll}
            disabled={exportingId != null || books.length === 0}
          >
            <Download className="w-3 h-3" strokeWidth={1.5} />
            {exportingId === -1 ? '导出中…' : '导出全部数据'}
          </Button>
          <ImportButton toaster={toaster} />
        </div>

        <div className="text-xs text-3 leading-relaxed">
          备份文件格式：<code className="font-mono">ai-novel-backup.v1.json</code>。
          超过 50MB 时会在导出后给出警告。
        </div>
      </div>
    </Section>
  );
}

function ImportButton({ toaster }: { toaster: ReturnType<typeof useToaster> }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dryRun, setDryRun] = React.useState<{
    bundle: BackupBundle;
    summary: BackupSummary;
  } | null>(null);
  const [applying, setApplying] = React.useState(false);

  const onPick = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许同名文件再次选择
    if (!file) return;

    if (file.size > BACKUP_WARN_SIZE_BYTES) {
      const ok = window.confirm(
        `备份文件大小 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 50MB，确认要继续吗？`,
      );
      if (!ok) return;
    }

    try {
      const text = await file.text();
      const r = validateBackup(text);
      if (!r.ok) {
        toaster.error('备份文件校验失败', r.error);
        return;
      }
      const summary = summarizeBackup(r.bundle);
      setDryRun({ bundle: r.bundle, summary });
    } catch (e) {
      toaster.error('读取文件失败', (e as Error).message);
    }
  };

  const onConfirm = async () => {
    if (!dryRun) return;
    setApplying(true);
    try {
      const r = await applyImport(dryRun.bundle, 'overwrite');
      toaster.success(
        '导入完成',
        `已写入 ${r.booksAffected} 本书 / ${r.chaptersAffected} 个章节`,
      );
      setDryRun(null);
    } catch (e) {
      toaster.error('导入失败', (e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button size="default" variant="default" onClick={onPick}>
        <Upload className="w-3 h-3" strokeWidth={1.5} /> 导入 JSON 备份
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFileChange}
      />

      <Dialog open={!!dryRun} onOpenChange={(o) => !o && setDryRun(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认导入备份？</DialogTitle>
            <DialogDescription>
              导入将覆盖当前数据库中相同 ID 的书籍及其全部关联数据（人物、地图、章节等）。
              请确认你了解此操作的影响。
            </DialogDescription>
          </DialogHeader>
          {dryRun && (
            <DialogBody>
              <div className="space-y-3 text-sm">
                <div className="text-xs text-2 tnum">
                  导出时间 {formatDateTime(dryRun.summary.exportedAt)} ·{' '}
                  Schema v{dryRun.summary.schemaVersion} ·{' '}
                  {dryRun.summary.scope === 'all-data' ? '全量' : '单书'}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs tnum">
                  <Stat label="书籍" value={dryRun.summary.booksCount} />
                  <Stat label="人物" value={dryRun.summary.charactersCount} />
                  <Stat label="关系" value={dryRun.summary.relationshipsCount} />
                  <Stat label="关系网节点" value={dryRun.summary.graphNodesCount} />
                  <Stat label="关系网连线" value={dryRun.summary.graphEdgesCount} />
                  <Stat label="境界" value={dryRun.summary.cultivationLevelsCount} />
                  <Stat label="装备" value={dryRun.summary.equipmentCount} />
                  <Stat label="技能" value={dryRun.summary.skillsCount} />
                  <Stat label="阵营" value={dryRun.summary.factionsCount} />
                  <Stat label="世界观" value={dryRun.summary.worldSettingsCount} />
                  <Stat label="章节" value={dryRun.summary.chaptersCount} highlight />
                </div>
                {dryRun.summary.bookName && (
                  <div className="text-xs text-2 pt-2 border-t border-border">
                    书名：<span className="text-text">{dryRun.summary.bookName}</span>
                  </div>
                )}
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDryRun(null)} disabled={applying}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={onConfirm} disabled={applying}>
              {applying ? '导入中…' : '确认覆盖导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`border-2 border-text bg-bg p-2 ${highlight ? 'shadow-[0_2px_0_0_#000]' : ''}`}>
      <div className="text-3">{label}</div>
      <div className="text-md font-semibold tnum">{value.toLocaleString()}</div>
    </div>
  );
}

// =============================================================================
// 3. 危险区
// =============================================================================

function DangerZoneSection({ toaster }: { toaster: ReturnType<typeof useToaster> }) {
  const [bookToDelete, setBookToDelete] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [bookConfirmText, setBookConfirmText] = React.useState('');

  const [showWipeAll, setShowWipeAll] = React.useState(false);
  const [wipeText, setWipeText] = React.useState('');

  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];

  const handleDeleteBook = async () => {
    if (!bookToDelete) return;
    if (bookConfirmText.trim() !== bookToDelete.name.trim()) {
      toaster.warning('书名不匹配', '请完整输入书籍名以确认');
      return;
    }
    try {
      await deleteBookCascade(bookToDelete.id);
      toaster.success(`已删除「${bookToDelete.name}」及其全部数据`);
      setBookToDelete(null);
      setBookConfirmText('');
    } catch (e) {
      toaster.error('删除失败', (e as Error).message);
    }
  };

  const handleWipeAll = async () => {
    if (wipeText.trim() !== '清空所有数据') {
      toaster.warning('确认文字不匹配', '请输入「清空所有数据」以确认');
      return;
    }
    try {
      await wipeAllData();
      toaster.success('已清空所有数据');
      setShowWipeAll(false);
      setWipeText('');
    } catch (e) {
      toaster.error('清空失败', (e as Error).message);
    }
  };

  return (
    <Section
      icon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}
      title="危险操作"
      hint="以下操作不可撤销。请先导出备份再执行。"
    >
      <div className="space-y-6">
        {/* 删除单本书 */}
        <div>
          <Label>删除单本书</Label>
          {books.length === 0 ? (
            <div className="text-xs text-3 border-2 border-text bg-bg p-3 shadow-[0_3px_0_0_#000]">还没有书籍</div>
          ) : (
            <div className="list-3d">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="list-row-3d flex items-center justify-between px-4 py-3 border-b-2 border-text last:border-b-0"
                >
                  <div className="text-sm truncate">{b.name}</div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => b.id != null && setBookToDelete({ id: b.id, name: b.name })}
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} /> 删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 清空全库 */}
        <div className="pt-4 border-t border-border">
          <Label>清空所有数据</Label>
          <Button size="default" variant="destructive" onClick={() => setShowWipeAll(true)}>
            <Trash2 className="w-3 h-3" strokeWidth={1.5} /> 清空所有数据
          </Button>
          <div className="text-xs text-3 mt-1">
            删除全部书籍以及关联的人物、地图、章节等。该操作不可撤销。
          </div>
        </div>
      </div>

      {/* 删除单本书确认 */}
      <Dialog open={!!bookToDelete} onOpenChange={(o) => !o && setBookToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除书籍？</DialogTitle>
            <DialogDescription>
              将同时删除该书的全部人物、地图、境界、装备、技能、阵营和章节。该操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {bookToDelete && (
            <DialogBody>
              <div className="text-sm leading-relaxed">
                请输入书籍名 <code className="font-mono bg-surface px-1">{bookToDelete.name}</code>{' '}
                以确认：
              </div>
              <Input
                value={bookConfirmText}
                onChange={(e) => setBookConfirmText(e.target.value)}
                placeholder={bookToDelete.name}
                className="mt-3"
                autoFocus
              />
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBookToDelete(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteBook}
              disabled={!bookToDelete || bookConfirmText.trim() !== bookToDelete.name.trim()}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清空全库确认 */}
      <Dialog open={showWipeAll} onOpenChange={setShowWipeAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空所有数据？</DialogTitle>
            <DialogDescription>
              此操作将删除全部 11 张表中的所有记录，包括全部书籍及其所有关联数据。该操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="text-sm leading-relaxed">
              请输入 <code className="font-mono bg-surface px-1">清空所有数据</code> 以确认：
            </div>
            <Input
              value={wipeText}
              onChange={(e) => setWipeText(e.target.value)}
              placeholder="清空所有数据"
              className="mt-3"
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowWipeAll(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleWipeAll}
              disabled={wipeText.trim() !== '清空所有数据'}
            >
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// =============================================================================
// 4. 关于
// =============================================================================

function AboutSection() {
  const [size, setSize] = React.useState<number>(0);
  const bookCount = useLiveQuery(() => db.books.count(), []) ?? 0;

  React.useEffect(() => {
    let mounted = true;
    estimateDbSize().then((s) => {
      if (mounted) setSize(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Section icon={<Database className="w-4 h-4" strokeWidth={1.5} />} title="关于" hint="">
      <div className="space-y-2 text-xs text-2 leading-relaxed">
        <div>
          <span className="text-3">版本：</span>
          <span className="text-text">v0.1.0</span>
        </div>
        <div>
          <span className="text-3">存储：</span>
          <span className="text-text tnum">
            {bookCount} 本书 · IndexedDB 已用 {formatBytes(size)}
          </span>
        </div>
        <div>
          <span className="text-3">架构：</span>
          <span className="text-text">前端 SPA · React + Vite + Dexie · 无后端</span>
        </div>
        <div className="pt-2 border-t border-border text-3">
          数据完全保存在你的浏览器，不会上传到任何服务器。建议定期导出 JSON 备份。
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// 通用 Section
// =============================================================================

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}

function Section({ icon, title, hint, children }: SectionProps) {
  return (
    <section className="panel-3d">
      <header className="px-6 py-4 border-b-2 border-text flex items-center gap-3">
        <div className="w-7 h-7 border-2 border-text bg-bg flex items-center justify-center shadow-[0_2px_0_0_#000]">{icon}</div>
        <div>
          <div className="text-md font-semibold">{title}</div>
          {hint && <div className="text-xs text-3">{hint}</div>}
        </div>
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}
