// =============================================================================
// ai-novel · 新建书籍
// 路径 /book/new
//   - 表单：名称（必填）、类型（下拉）、简介
//   - 提交后写入 db.books，跳转到 /book/:bookId
// =============================================================================

import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/db/database';
import { useToaster } from '@/hooks/useToaster';

/** 类型枚举（与开发文档 3.3 节一致 + 补充"其他"） */
const GENRES = ['仙侠', '奇幻', '玄幻', '武侠', '科幻', '都市', '历史', '其他'] as const;
type Genre = (typeof GENRES)[number];

export default function NewBook() {
  const navigate = useNavigate();
  const toaster = useToaster();

  const [name, setName] = React.useState('');
  const [genre, setGenre] = React.useState<Genre>('仙侠');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const nameTrimmed = name.trim();
  const canSubmit = nameTrimmed.length > 0 && !submitting;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const id = await db.books.add({
        name: nameTrimmed,
        genre,
        description: description.trim(),
        createdAt: now,
        updatedAt: now,
        status: 'ongoing',
      });
      toaster.success(`已创建「${nameTrimmed}」`, '开始构建你的世界观');
      navigate(`/book/${id}`);
    } catch (err) {
      toaster.error('创建失败', (err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-12 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center w-8 h-8 border-2 border-text bg-bg shadow-[0_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#000] active:translate-y-[1px] active:shadow-[0_1px_0_0_#000] transition-all"
              aria-label="返回首页"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            </Link>
            <div>
              <div className="text-xs tnum text-3">NEW BOOK · 新建书籍</div>
              <div className="text-md font-semibold">创建新作品</div>
            </div>
          </div>
          <Link to="/" className="text-xs text-2 hover:text-text inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" strokeWidth={1.5} /> 返回首页
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-12 py-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 标题 */}
          <div className="border-b border-text pb-2">
            <div className="text-xs tnum text-3 mb-1">SECTION 01 / METADATA</div>
            <h1 className="text-2xl font-semibold">书籍基本信息</h1>
            <p className="text-sm text-2 mt-1 leading-relaxed">
              书名确定后可在书籍总览页修改。类型用于分类筛选，简介会出现在首页卡片上。
            </p>
          </div>

          {/* 书名 */}
          <div className="grid gap-2">
            <Label htmlFor="book-name">
              书名 <span className="text-[#333]">*</span>
            </Label>
            <Input
              id="book-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：九州仙途"
              maxLength={60}
              autoFocus
              required
            />
            <div className="text-xs text-3 flex items-center justify-between">
              <span>必填 · {nameTrimmed.length} / 60</span>
              {nameTrimmed.length === 0 && <span className="text-[#333]">书名不能为空</span>}
            </div>
          </div>

          {/* 类型 */}
          <div className="grid gap-2">
            <Label htmlFor="book-genre">类型</Label>
            <Select value={genre} onValueChange={(v) => setGenre(v as Genre)}>
              <SelectTrigger id="book-genre" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-3">
              选填。决定首页卡片和总览页的归类，不影响后续模块使用。
            </div>
          </div>

          {/* 简介 */}
          <div className="grid gap-2">
            <Label htmlFor="book-desc">简介</Label>
            <Textarea
              id="book-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="用一两段话介绍故事梗概，会显示在首页卡片上……"
              rows={5}
              maxLength={500}
            />
            <div className="text-xs text-3">{description.length} / 500</div>
          </div>

          {/* 提示框 */}
          <div className="border-2 border-text bg-surface p-4 text-xs text-2 leading-relaxed shadow-[0_4px_0_0_#000]">
            <div className="font-semibold mb-1">即将创建：</div>
            <div className="text-text">
              「<span className="font-semibold">{nameTrimmed || '（书名待填）'}</span>」 · {genre}
            </div>
            <div className="text-3 mt-2">
              创建后将跳转到书籍总览，从 L1（开局构思）开始填充世界观，逐步解锁后续 Level。
            </div>
          </div>

          {/* 操作 */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Link to="/">
              <Button type="button" variant="ghost" size="default">
                取消
              </Button>
            </Link>
            <Button type="submit" variant="ghost" size="default" disabled={!canSubmit}>
              <BookPlus className="w-3 h-3" strokeWidth={1.5} />
              {submitting ? '创建中…' : '创建并进入总览'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
