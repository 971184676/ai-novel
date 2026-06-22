// =============================================================================
// novel-creator · API Key 申请教程（图文并茂）
// 在 Settings 页 ApiKeySection 下方展示，引导用户去 DeepSeek 平台自助申请 key
// 图片素材放 public/tutorial/ 下，build 时 Vite 会原样拷贝
// =============================================================================

import * as React from 'react';
import { ExternalLink, KeyRound, Sparkles, Wallet, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  /** 步骤编号（两位数 01 / 02） */
  no: string;
  /** 步骤标题 */
  title: string;
  /** 步骤说明（一两句话） */
  desc: string;
  /** 截图相对路径（/tutorial/xxx.png） */
  img: string;
  /** 截图上的红色标注框（绝对定位，百分比） */
  highlights?: Highlight[];
  /** 该步的"操作要点"callout */
  callout?: { kind: 'tip' | 'warn' | 'key'; text: string };
}

interface Highlight {
  /** 红色边框方框，覆盖在截图上。0~100 百分比 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 方框旁边的小标签（可选） */
  label?: string;
}

const STEPS: Step[] = [
  {
    no: '01',
    title: '打开 DeepSeek 官网',
    desc: '在浏览器地址栏输入 deepseek.com 进入官网。DeepSeek 是国内可直接访问的 AI 大模型平台，AI 扩写功能由它提供。',
    img: '/tutorial/deepseek-1-home.png',
    callout: { kind: 'tip', text: '也可以直接访问 platform.deepseek.com 跳过首页。' },
  },
  {
    no: '02',
    title: '进入「开放平台」并登录',
    desc: '点击官网底部「开放平台」链接，进入 platform.deepseek.com。未注册的手机号会自动注册。',
    img: '/tutorial/deepseek-2-login.png',
    callout: {
      kind: 'tip',
      text: '两种登录方式：①手机号 + 验证码 ②微信扫码。推荐手机号，最快。',
    },
  },
  {
    no: '03',
    title: '（可选）先充值一点余额',
    desc: 'AI 扩写是按 token 计费的。点击左侧「充值」进入充值页，金额自定（最少 ¥1 起）。',
    img: '/tutorial/deepseek-4-topup.png',
    callout: {
      kind: 'warn',
      text: '网页版 / App 端对话是免费的，仅 API 调用才计费。充值后无法退款，先充 ¥10 试水即可。',
    },
  },
  {
    no: '04',
    title: '进入「API keys」页面',
    desc: '左侧菜单点「API keys」，这里列出你所有的 key。点击下方「创建 API key」按钮开始新建。',
    img: '/tutorial/deepseek-3-apikeys.png',
    highlights: [
      { x: 4, y: 22, w: 20, h: 8, label: '左侧菜单：API keys' },
      { x: 27, y: 56, w: 30, h: 7, label: '创建 API key 按钮' },
    ],
  },
  {
    no: '05',
    title: '为 key 起个名字',
    desc: '弹窗里给你的 key 起个易记的名字（如 "novel-creator"），方便日后识别。',
    img: '/tutorial/deepseek-5-create.png',
    callout: { kind: 'tip', text: '名字随便起，只在你这边显示，平台不校验。' },
  },
  {
    no: '06',
    title: '点「创建」拿到 key',
    desc: '点击「创建」后立即弹出 key。点「复制」按钮把整段 sk- 开头的字符串复制到剪贴板。',
    img: '/tutorial/deepseek-7-key.png',
    callout: {
      kind: 'key',
      text: '这步是关键！key 只在创建瞬间完整显示一次，关闭后只能看到脱敏后的 sk-*** 形式。务必先复制再关弹窗。',
    },
  },
  {
    no: '07',
    title: '粘贴到上方「API Key」输入框',
    desc: '回到本应用的「设置 → AI 服务配置」页（你现在所在的位置），把刚才复制的 key 粘到「录入 / 覆盖」输入框，点击保存。',
    img: '/tutorial/settings-keyinput.png',
    highlights: [
      { x: 7, y: 58, w: 86, h: 10, label: '录入 / 覆盖 输入框 + 保存按钮' },
    ],
    callout: {
      kind: 'tip',
      text: '保存后点「测试连接」按钮，4 秒内返回「连接成功」就 OK 了。',
    },
  },
];

export function ApiKeyTutorial() {
  return (
    <section className="panel-3d">
      <header className="px-6 py-4 border-b-2 border-text flex items-center gap-3">
        <div className="w-7 h-7 border-2 border-text bg-bg flex items-center justify-center shadow-[0_2px_0_0_#000]">
          <Sparkles className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-md font-semibold">DeepSeek API Key 申请教程</div>
          <div className="text-xs text-3">
            7 步图文指引 · 大约 3 分钟搞定
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-8">
        {/* 总览引导 */}
        <div className="border-2 border-text bg-surface p-4 shadow-[0_3px_0_0_#000] text-sm leading-relaxed">
          <div className="flex items-start gap-3">
            <KeyRound className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <div className="font-semibold mb-1">本应用使用 DeepSeek 大模型</div>
              <div>
                AI 扩写、重新生成、章节摘要都由它驱动。你需要去 DeepSeek
                开放平台自助申请一个 API Key，费用按 token 计费（一次扩写约 ¥0.01~0.05）。
                key 只保存在你浏览器的 localStorage，不会上传到任何服务器。
              </div>
            </div>
          </div>
        </div>

        {/* 步骤列表 */}
        <ol className="space-y-10">
          {STEPS.map((step) => (
            <li key={step.no} className="space-y-3">
              <StepHeader step={step} />
              <p className="text-sm leading-relaxed text-text">{step.desc}</p>
              {step.callout && <Callout {...step.callout} />}
              <Screenshot img={step.img} alt={step.title} highlights={step.highlights} />
            </li>
          ))}
        </ol>

        {/* 结尾汇总 */}
        <div className="border-2 border-text bg-bg p-5 shadow-[0_4px_0_0_#000]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" strokeWidth={1.5} />
            <div className="text-sm leading-relaxed space-y-2">
              <div className="font-semibold">全部完成？核对清单</div>
              <ul className="list-none space-y-1.5 pl-0">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-text inline-block mt-2 shrink-0" />
                  DeepSeek 账号已注册并登录
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-text inline-block mt-2 shrink-0" />
                  充值了至少 ¥1 余额（API 才会真发请求）
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-text inline-block mt-2 shrink-0" />
                  创建并复制了 sk- 开头的 key
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-text inline-block mt-2 shrink-0" />
                  回到本页面粘贴 key 并保存
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-text inline-block mt-2 shrink-0" />
                  点「测试连接」返回"连接成功" → 大功告成
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 外链 */}
        <div className="text-xs text-3 flex flex-wrap gap-4 pt-2 border-t border-border">
          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-text"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} /> 打开 API keys 页面
          </a>
          <a
            href="https://platform.deepseek.com/top_up"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-text"
          >
            <Wallet className="w-3 h-3" strokeWidth={1.5} /> 打开充值页面
          </a>
          <a
            href="https://platform.deepseek.com/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-text"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} /> 查看用量
          </a>
          <a
            href="https://api-docs.deepseek.com/zh-cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-text"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} /> API 文档
          </a>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 步骤标题：编号 + 标题
// =============================================================================

function StepHeader({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 border-2 border-text bg-text text-bg flex items-center justify-center font-mono font-bold text-sm shadow-[0_3px_0_0_#000]">
        {step.no}
      </div>
      <h3 className="text-md font-semibold leading-tight">{step.title}</h3>
    </div>
  );
}

// =============================================================================
// 提示框：tip（灰底）/ warn（深灰边框 + 浅灰底）/ key（黑底白字）
// =============================================================================

function Callout({ kind, text }: { kind: 'tip' | 'warn' | 'key'; text: string }) {
  const cls = {
    tip: 'border-2 border-border bg-surface text-2',
    warn: 'border-2 border-text bg-surface text-text',
    key: 'border-2 border-text bg-text text-bg',
  }[kind];
  const icon = {
    tip: '💡',
    warn: '⚠️',
    key: '🔑',
  }[kind];
  return (
    <div className={cn('inline-flex items-start gap-2 px-3 py-2 text-xs leading-relaxed', cls)}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// =============================================================================
// 截图容器：白底黑边 + 硬阴影，可叠加红色标注方框
// =============================================================================

function Screenshot({
  img,
  alt,
  highlights,
}: {
  img: string;
  alt: string;
  highlights?: Highlight[];
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);

  return (
    <figure className="border-2 border-text bg-bg shadow-[0_4px_0_0_#000] overflow-hidden">
      <div className="relative">
        {!errored ? (
          <img
            src={img}
            alt={alt}
            loading="lazy"
            className={cn(
              'block w-full h-auto select-none',
              'transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            draggable={false}
          />
        ) : (
          <div className="aspect-video flex items-center justify-center bg-surface text-xs text-2 p-4">
            截图加载失败：<code className="font-mono">{img}</code>
          </div>
        )}

        {/* 标注方框：截图上的红色高亮 */}
        {loaded && !errored && highlights?.map((h, i) => (
          <div
            key={i}
            className="absolute border-2 border-[#E03131] pointer-events-none"
            style={{
              left: `${h.x}%`,
              top: `${h.y}%`,
              width: `${h.w}%`,
              height: `${h.h}%`,
            }}
          >
            {h.label && (
              <div className="absolute -top-7 left-0 inline-flex items-center px-2 py-0.5 bg-[#E03131] text-bg text-[11px] font-medium whitespace-nowrap shadow-[0_2px_0_0_#000]">
                {h.label}
              </div>
            )}
          </div>
        ))}

        {!loaded && !errored && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface text-xs text-2">
            加载中…
          </div>
        )}
      </div>
      <figcaption className="px-3 py-2 border-t-2 border-text bg-surface text-xs text-2 flex items-center justify-between">
        <span>{alt}</span>
        <span className="font-mono text-3">{img.split('/').pop()}</span>
      </figcaption>
    </figure>
  );
}
