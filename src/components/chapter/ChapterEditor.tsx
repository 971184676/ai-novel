// =============================================================================
// novel-ai-chapter-dev · 章节编辑器（TipTap）
//
// 严格对齐开发文档 10 节：
//   - 起步包 @tiptap/starter-kit
//   - 自定义扩展：中文段落首行缩进 2em、text-align: justify
//   - 工具栏：撤销/重做、加粗/斜体、标题、列表、引用、分隔线、字数统计
//   - 自动保存：编辑停顿 2s 后写回 chapters.content
//   - 输出 HTML 存到 IndexedDB，读取时 parse
//   - final 状态只读（按钮置灰 + 二次确认解锁）
// =============================================================================

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  List as ListIcon,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Pilcrow,
  Minus,
  Lock,
  Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, wordCount } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// =============================================================================
// 字数统计（中文/英文分开）
// =============================================================================

export interface WordCountResult {
  /** 总词数（中文按字 + 英文按词） */
  total: number;
  /** 中文字数（不含标点） */
  chinese: number;
  /** 英文单词数 */
  english: number;
  /** 段落数（按 <p> 计数） */
  paragraphs: number;
  /** 估算阅读时长（分钟，按 300 字/分钟） */
  readMinutes: number;
}

export function computeWordCount(html: string): WordCountResult {
  // 去掉标签
  const text = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, '');
  const cjkMatches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const chinese = cjkMatches ? cjkMatches.length : 0;
  const remaining = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
  const english = remaining.trim().split(/\s+/).filter(Boolean).length;
  const paragraphs = (html.match(/<p\b/gi) || []).length;
  const total = chinese + english;
  const readMinutes = Math.max(1, Math.round(total / 300));
  return { total, chinese, english, paragraphs, readMinutes };
}

// =============================================================================
// 工具栏按钮
// =============================================================================

interface ToolBtnProps {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolBtn({ active, disabled, title, onClick, children }: ToolBtnProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center h-7 w-7 border-2 border-transparent transition-all',
        'hover:border-text disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-transparent',
        active && 'bg-bg text-text border-text shadow-[0_2px_0_0_#000] -translate-y-0.5',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" />;
}

// =============================================================================
// 工具栏
// =============================================================================

interface ToolbarProps {
  editor: Editor | null;
  readOnly: boolean;
}

function Toolbar({ editor, readOnly }: ToolbarProps) {
  if (!editor) return null;
  return (
    <div className="ed-toolbar flex flex-wrap items-center gap-0.5 p-1 border-2 border-text bg-bg shadow-[0_3px_0_0_#000] w-full sm:w-auto sm:inline-flex">
      <ToolBtn
        title="撤销 (Ctrl+Z)"
        disabled={readOnly || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="重做 (Ctrl+Y)"
        disabled={readOnly || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>

      <Divider />

      <ToolBtn
        title="标题 1"
        active={editor.isActive('heading', { level: 1 })}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="标题 2"
        active={editor.isActive('heading', { level: 2 })}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="正文段落"
        active={editor.isActive('paragraph')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>

      <Divider />

      <ToolBtn
        title="加粗 (Ctrl+B)"
        active={editor.isActive('bold')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="斜体 (Ctrl+I)"
        active={editor.isActive('italic')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>

      <Divider />

      <ToolBtn
        title="无序列表"
        active={editor.isActive('bulletList')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="有序列表"
        active={editor.isActive('orderedList')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="引用"
        active={editor.isActive('blockquote')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        title="行内代码"
        active={editor.isActive('code')}
        disabled={readOnly}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>

      <Divider />

      <ToolBtn
        title="分隔线"
        disabled={readOnly}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="w-3 h-3" strokeWidth={1.5} />
      </ToolBtn>
    </div>
  );
}

// =============================================================================
// 编辑器主体
// =============================================================================

export interface ChapterEditorProps {
  /** 初始 HTML */
  initialContent: string;
  /** 内容变化回调（每次输入触发，debounce 由外部控制） */
  onChange?: (html: string) => void;
  /** 防抖保存回调（debounce 2s 后调用） */
  onAutosave?: (html: string) => void | Promise<void>;
  /** 是否只读（final 状态强制只读） */
  readOnly?: boolean;
  /** 编辑器 placeholder */
  placeholder?: string;
  /** 自定义 className */
  className?: string;
}

/** 防抖默认 2000ms */
const AUTOSAVE_DEBOUNCE_MS = 2000;

export function ChapterEditor({
  initialContent,
  onChange,
  onAutosave,
  readOnly = false,
  placeholder = '在此书写章节正文……',
  className,
}: ChapterEditorProps) {
  const [stats, setStats] = useState<WordCountResult>(() =>
    computeWordCount(initialContent || ''),
  );

  // 保存定时器 ref
  const timerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>(initialContent);
  const onAutosaveRef = useRef(onAutosave);
  useEffect(() => {
    onAutosaveRef.current = onAutosave;
  }, [onAutosave]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: initialContent || '',
    editable: !readOnly,
    immediatelyRender: false, // 关键：SSR / 第一次渲染时不要直接输出到 DOM
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setStats(computeWordCount(html));
      onChange?.(html);
      // 防抖自动保存
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (html !== lastSavedRef.current) {
          lastSavedRef.current = html;
          onAutosaveRef.current?.(html);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  // 切换 readOnly 时同步编辑器状态
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // 卸载前如果还有未保存的内容，立即 flush
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        if (editor) {
          const html = editor.getHTML();
          if (html !== lastSavedRef.current) {
            onAutosaveRef.current?.(html);
          }
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 initialContent 变化时同步（切换章节场景）
  const lastInitialRef = useRef(initialContent);
  useEffect(() => {
    if (!editor) return;
    if (initialContent !== lastInitialRef.current) {
      lastInitialRef.current = initialContent;
      lastSavedRef.current = initialContent;
      editor.commands.setContent(initialContent || '', false);
      setStats(computeWordCount(initialContent || ''));
    }
  }, [editor, initialContent]);

  const proseClass = useMemo(
    () =>
      cn(
        'prose-novel',
        'outline-none',
        'text-text',
        readOnly && 'cursor-default',
        className,
      ),
    [readOnly, className],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 sticky top-0 z-10 bg-bg pb-2 mb-2 border-b border-border flex flex-wrap items-start gap-2">
        <Toolbar editor={editor} readOnly={readOnly} />
        {readOnly && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-3 shrink-0 mt-0.5">
            <Lock className="w-3 h-3" strokeWidth={1.5} /> 只读
          </span>
        )}
      </div>

      {/* 文本编辑区：占满剩余空间，超出时纵向滚动 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1 -mx-1">
        <EditorContent editor={editor} className={proseClass} data-placeholder={placeholder} />
      </div>
    </div>
  );
}

// =============================================================================
// "解锁定稿" 按钮 —— 给 Pages 层用
// =============================================================================

interface UnlockButtonProps {
  locked: boolean;
  onToggle: () => void;
}

export function FinalStateToggle({ locked, onToggle }: UnlockButtonProps) {
  return (
    <Button variant={locked ? 'ghost' : 'primary'} size="sm" onClick={onToggle}>
      {locked ? (
        <>
          <Unlock className="w-3 h-3" strokeWidth={1.5} /> 解锁编辑
        </>
      ) : (
        <>
          <Lock className="w-3 h-3" strokeWidth={1.5} /> 重新锁定
        </>
      )}
    </Button>
  );
}