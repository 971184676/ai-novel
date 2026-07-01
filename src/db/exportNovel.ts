// =============================================================================
// ai-novel · 导出整本小说为 DOCX（Word 文档）
//
// 跟 exportImport.ts 的 JSON 备份是两个用途：
//   - 导出备份 (JSON)：保存数据库全部表，用于跨设备迁移 / 灾难恢复
//   - 导出小说 (DOCX)：把已完成的章节正文导出成可阅读 / 可发行的 Word 文档
//
// 输出结构：
//   1. 封面（书名、类型、创建日期、简介）
//   2. 目录
//   3. 各章正文（按 chapterNumber 升序）
//   4. 页脚：导出时间 + 字数统计
// =============================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Footer,
  PageNumber,
} from 'docx';
import { saveBlobAs } from './fileSaver';
import { db } from './database';
import { wordCount } from '@/lib/utils';
import type { Chapter, ChapterStatus } from './types';

const STATUS_LABEL: Record<ChapterStatus, string> = {
  outline: '大纲',
  expanded: '扩写',
  edited: '编辑',
  final: '定稿',
};

interface ExportOptions {
  /** 只导出状态 >= 此级别的章节（默认 'outline' = 全部） */
  minStatus?: ChapterStatus;
}

const STATUS_RANK: Record<ChapterStatus, number> = {
  outline: 0,
  expanded: 1,
  edited: 2,
  final: 3,
};

/** 触发浏览器下载（用 Blob URL） */
// 注：实际下载由 saveBlobAs 提供，下面是 status 提示用。

/** 安全文件名（去掉 Windows / Mac 不允许的字符） */
function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

/** 把章节内容按段落拆成 docx Paragraph 数组。
 *  优先用 \n\n 作段落分隔；单个 \n 渲染为段内换行。 */
function chapterToParagraphs(chapter: Chapter): Paragraph[] {
  const raw = chapter.content?.trim();
  if (!raw) {
    return [
      new Paragraph({
        children: [new TextRun({ text: '（本章暂无正文）', italics: true, color: '888888' })],
      }),
    ];
  }
  const blocks = raw.split(/\n\s*\n/);
  return blocks.map(
    (block) =>
      new Paragraph({
        spacing: { line: 360, before: 60, after: 60 }, // 1.5 倍行距
        children: block.split('\n').flatMap((line, idx, arr) => {
          const runs: TextRun[] = [new TextRun({ text: line })];
          if (idx < arr.length - 1) {
            runs.push(new TextRun({ break: 1 }));
          }
          return runs;
        }),
      }),
  );
}

/** 主入口：导出整本书为 DOCX，触发浏览器下载 */
export async function exportNovel(
  bookId: number,
  opts: ExportOptions = {},
): Promise<{ filename: string; size: number; chaptersExported: number }> {
  const book = await db.books.get(bookId);
  if (!book) {
    throw new Error(`书籍 #${bookId} 不存在`);
  }

  const allChapters = await db.chapters.where('bookId').equals(bookId).toArray();
  const minRank = STATUS_RANK[opts.minStatus ?? 'outline'];
  const chapters = allChapters
    .filter((c) => STATUS_RANK[c.status] >= minRank)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (chapters.length === 0) {
    throw new Error('当前书籍还没有章节，无法导出小说');
  }

  const totalWords = chapters.reduce((sum, c) => sum + wordCount(c.content || ''), 0);
  const now = new Date();

  // ----- 封面 -----
  const cover: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 600 },
      children: [
        new TextRun({
          text: book.name || '（未命名）',
          bold: true,
          size: 56, // 28pt
          font: 'SimSun',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${book.genre || '未分类'} · 创建于 ${formatDate(book.createdAt)}`,
          size: 24,
          color: '666666',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
      children: [
        new TextRun({
          text: `共 ${chapters.length} 章 · 约 ${totalWords.toLocaleString()} 字`,
          size: 22,
          color: '888888',
        }),
      ],
    }),
    ...(book.description
      ? book.description
          .split(/\n\s*\n/)
          .map(
            (p) =>
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 360, after: 200 },
                children: [
                  new TextRun({ text: p.trim(), size: 22, color: '333333' }),
                ],
              }),
          )
      : []),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ----- 目录 -----
  const toc: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: '目  录', bold: true, size: 36 })],
    }),
    ...chapters.map(
      (c) =>
        new Paragraph({
          spacing: { after: 100 },
          tabStops: [{ type: 'right', position: 9000, leader: 'dot' }],
          children: [
            new TextRun({ text: `第 ${String(c.chapterNumber).padStart(3, '0')} 章  ${c.title || '（未命名）'}`, size: 22 }),
            new TextRun({ text: '\t' }),
            new TextRun({ text: STATUS_LABEL[c.status], size: 20, color: '888888' }),
          ],
        }),
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ----- 各章正文 -----
  const chapterSections: Paragraph[] = [];
  chapters.forEach((c, idx) => {
    chapterSections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [
          new TextRun({
            text: `第 ${String(c.chapterNumber).padStart(3, '0')} 章`,
            size: 28,
            color: '888888',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: c.title || '（未命名）',
            bold: true,
            size: 40,
            font: 'SimSun',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: `${STATUS_LABEL[c.status]} · ${wordCount(c.content || '').toLocaleString()} 字`,
            italics: true,
            size: 20,
            color: '999999',
          }),
        ],
      }),
      ...chapterToParagraphs(c),
    );
    // 章节之间分页（除最后一章）
    if (idx < chapters.length - 1) {
      chapterSections.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  // ----- 组装 Document -----
  const doc = new Document({
    creator: 'Novel Creator',
    title: book.name || 'Untitled',
    description: book.description || '',
    styles: {
      default: {
        document: {
          run: {
            font: 'SimSun',
            size: 22, // 小四（11pt）
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `由 Novel Creator 导出 · ${formatDate(now)}`,
                    size: 18,
                    color: '999999',
                  }),
                  new TextRun({ text: '    ·    ', size: 18, color: 'BBBBBB' }),
                  new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页 / 共 ', PageNumber.TOTAL_PAGES, ' 页'], size: 18, color: '999999' }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, ...toc, ...chapterSections],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${safeFilename(book.name)}-${formatStamp(now)}.docx`;
  saveBlobAs(blob, filename);
  return { filename, size: blob.size, chaptersExported: chapters.length };
}

function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function formatDate(d: Date): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
