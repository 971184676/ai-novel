// =============================================================================
// novel-creator 的 DeepSeek API 调用封装
// 严格遵循开发文档第 9 节要求
//   - 默认 API: https://api.deepseek.com/v1/chat/completions（可在 Settings 页改成自定义 URL）
//   - 模型: deepseek-chat, max_tokens=4096, temperature=0.7
//   - 鉴权: Authorization: Bearer ${apiKey}
//   - key 从 localStorage 读取（key 名 `deepseek_api_key`）
//   - 错误处理：401/429/网络错误/CORS 分别提示
//   - 支持取消（AbortController）
//   - 流式调用 fetch + ReadableStream 打字机效果
// =============================================================================

import type { AINovelContext } from './prompts';

const DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/** 默认 API URL（OpenAI 兼容协议） */
export const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions';

/** localStorage 中存储 API Key 的 key 名 */
export const API_KEY_STORAGE_KEY = 'deepseek_api_key';
/** localStorage 中存储 API URL 的 key 名 */
export const API_URL_STORAGE_KEY = 'deepseek_api_url';

// =============================================================================
// 公开类型
// =============================================================================

export interface DeepSeekCallOptions {
  /** 从 localStorage 读取的 API Key，也可外部传入覆盖 */
  apiKey?: string;
  /** 已经构建好的上下文 */
  context: AINovelContext;
  maxTokens?: number;
  temperature?: number;
  /** 取消信号（AbortController.signal）*/
  signal?: AbortSignal;
}

export interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface DeepSeekResponse {
  content: string;
  usage?: DeepSeekUsage;
  /** 实际使用的模型名 */
  model?: string;
}

/** 业务层错误类型 —— UI 可根据 kind 做不同提示 */
export type DeepSeekErrorKind =
  | 'no_api_key'
  | 'invalid_api_key' // 401
  | 'rate_limited' // 429
  | 'network'
  | 'cors'
  | 'bad_request' // 400
  | 'server_error' // 5xx
  | 'aborted'
  | 'unknown';

export class DeepSeekError extends Error {
  readonly kind: DeepSeekErrorKind;
  readonly status?: number;
  readonly raw?: unknown;

  constructor(
    kind: DeepSeekErrorKind,
    message: string,
    options: { status?: number; raw?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'DeepSeekError';
    this.kind = kind;
    this.status = options.status;
    this.raw = options.raw;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/** 流式回调 */
export interface DeepSeekStreamHandlers {
  /** 收到一段增量文本 */
  onDelta?: (delta: string) => void;
  /** 流结束，返回拼接后的完整内容 */
  onDone?: (full: string, usage?: DeepSeekUsage) => void;
  /** 抛错时 */
  onError?: (err: DeepSeekError) => void;
}

// =============================================================================
// API Key 工具
// =============================================================================

/** 从 localStorage 读取 API Key。 */
export function getApiKey(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 写入 API Key。 */
export function setApiKey(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // localStorage 不可用（隐私模式 / 磁盘满），忽略
  }
}

/** 判断 Key 是否存在且非空 */
export function hasApiKey(): boolean {
  return getApiKey().trim().length > 0;
}

/** 从 localStorage 读取 API URL，未配置则返回默认值（OpenAI 兼容协议） */
export function getApiUrl(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_API_URL;
  try {
    const url = localStorage.getItem(API_URL_STORAGE_KEY);
    return url && url.trim() ? url.trim() : DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

/** 写入 API URL（传空字符串则删除并回到默认值） */
export function setApiUrl(url: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = url.trim();
    if (trimmed) localStorage.setItem(API_URL_STORAGE_KEY, trimmed);
    else localStorage.removeItem(API_URL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 重置 URL 到默认值 */
export function resetApiUrl(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(API_URL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// =============================================================================
// 内部辅助：判断是否 CORS 失败
// =============================================================================

/**
 * 浏览器 CORS 预检失败时，fetch 通常会 reject TypeError。
 * 但和真实网络错误的 TypeError 难以 100% 区分 —— 我们用启发式：
 *   - 状态码缺失 + TypeError + 没有 aborted → 可能是 CORS 或网络
 *   - 给出明确文案让用户按文档装扩展或换网络
 */
function isCorsLikely(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  );
}

// =============================================================================
// 内部：构造 fetch body
// =============================================================================

function buildRequestBody(opts: DeepSeekCallOptions, stream: boolean) {
  return {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system' as const, content: opts.context.systemPrompt },
      {
        role: 'user' as const,
        content: opts.context.userPrompt,
      },
    ],
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    stream,
  };
}

// =============================================================================
// 主调用：callDeepSeek（非流式）
// =============================================================================

/**
 * 调用 DeepSeek chat completions，返回完整内容。
 * API Key 缺失/失败/网络/CORS 都抛 DeepSeekError，UI 可按 kind 区分。
 */
export async function callDeepSeek(opts: DeepSeekCallOptions): Promise<DeepSeekResponse> {
  const apiKey = (opts.apiKey ?? getApiKey()).trim();
  if (!apiKey) {
    throw new DeepSeekError(
      'no_api_key',
      '尚未配置 DeepSeek API Key，请前往「设置」页面录入。',
    );
  }

  let res: Response;
  try {
    res = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(opts, false)),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new DeepSeekError('aborted', '请求已取消', { cause: err });
    }
    if (isCorsLikely(err)) {
      throw new DeepSeekError(
        'cors',
        '浏览器拦截了到 DeepSeek 的跨域请求（CORS）。请安装「Allow CORS」扩展后重试，或在本地用 Vite dev proxy。',
        { cause: err },
      );
    }
    throw new DeepSeekError(
      'network',
      `网络错误：${(err as Error)?.message ?? 'unknown'}`,
      { cause: err },
    );
  }

  if (!res.ok) {
    await throwForHttpError(res);
  }

  const data = await res.json().catch((err) => {
    throw new DeepSeekError('unknown', '返回内容不是合法 JSON', { cause: err });
  });

  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new DeepSeekError(
      'unknown',
      'DeepSeek 返回了空内容（可能被安全策略过滤）。',
      { raw: data },
    );
  }

  return {
    content,
    usage: data?.usage,
    model: data?.model ?? DEEPSEEK_MODEL,
  };
}

async function throwForHttpError(res: Response): Promise<never> {
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message ?? JSON.stringify(j).slice(0, 200);
  } catch {
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      detail = '';
    }
  }

  switch (res.status) {
    case 400:
      throw new DeepSeekError(
        'bad_request',
        `请求参数错误（400）：${detail || '请检查 prompt / max_tokens'}`,
        { status: 400, raw: detail },
      );
    case 401:
      throw new DeepSeekError(
        'invalid_api_key',
        'API Key 无效或已过期（401）。请到「设置」检查 deepseek_api_key。',
        { status: 401, raw: detail },
      );
    case 403:
      throw new DeepSeekError(
        'invalid_api_key',
        `API Key 没有访问权限（403）：${detail}`,
        { status: 403, raw: detail },
      );
    case 429:
      throw new DeepSeekError(
        'rate_limited',
        '请求过于频繁或余额不足（429）。请稍后再试，或到 DeepSeek 控制台充值。',
        { status: 429, raw: detail },
      );
    default:
      if (res.status >= 500) {
        throw new DeepSeekError(
          'server_error',
          `DeepSeek 服务异常（${res.status}）：${detail || res.statusText}`,
          { status: res.status, raw: detail },
        );
      }
      throw new DeepSeekError(
        'unknown',
        `请求失败（${res.status}）：${detail || res.statusText}`,
        { status: res.status, raw: detail },
      );
  }
}

// =============================================================================
// 流式调用：streamDeepSeek
// =============================================================================

/**
 * 流式调用 DeepSeek，使用 fetch + ReadableStream 读取 SSE。
 * - 每收到一段 delta 文本就调用 handlers.onDelta
 * - 全部结束后调用 handlers.onDone，传入拼接好的完整文本
 * - 出错调用 handlers.onError
 * - 取消（opts.signal.abort()）后停止读取，不再触发任何回调
 */
export async function streamDeepSeek(
  opts: DeepSeekCallOptions,
  handlers: DeepSeekStreamHandlers = {},
): Promise<{ content: string; usage?: DeepSeekUsage }> {
  const apiKey = (opts.apiKey ?? getApiKey()).trim();
  if (!apiKey) {
    const err = new DeepSeekError(
      'no_api_key',
      '尚未配置 DeepSeek API Key，请前往「设置」页面录入。',
    );
    handlers.onError?.(err);
    throw err;
  }

  let res: Response;
  try {
    res = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(buildRequestBody(opts, true)),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      const e = new DeepSeekError('aborted', '请求已取消', { cause: err });
      handlers.onError?.(e);
      throw e;
    }
    if (isCorsLikely(err)) {
      const e = new DeepSeekError(
        'cors',
        '浏览器拦截了到 DeepSeek 的跨域请求（CORS）。请安装「Allow CORS」扩展后重试。',
        { cause: err },
      );
      handlers.onError?.(e);
      throw e;
    }
    const e = new DeepSeekError(
      'network',
      `网络错误：${(err as Error)?.message ?? 'unknown'}`,
      { cause: err },
    );
    handlers.onError?.(e);
    throw e;
  }

  if (!res.ok) {
    await throwForHttpError(res);
  }
  if (!res.body) {
    const e = new DeepSeekError('unknown', '响应没有可读流', { status: res.status });
    handlers.onError?.(e);
    throw e;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  let usage: DeepSeekUsage | undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE: 形如 "data: {...}\n\n"，以空行分隔事件
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const line = rawEvent.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta: string = json?.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            full += delta;
            handlers.onDelta?.(delta);
          }
          if (json?.usage) usage = json.usage;
        } catch {
          // 忽略单条解析失败，继续读流
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      const e = new DeepSeekError('aborted', '请求已取消', { cause: err });
      handlers.onError?.(e);
      throw e;
    }
    const e = new DeepSeekError(
      'network',
      `读取流失败：${(err as Error)?.message ?? 'unknown'}`,
      { cause: err },
    );
    handlers.onError?.(e);
    throw e;
  }

  handlers.onDone?.(full, usage);
  return { content: full, usage };
}

// =============================================================================
// 摘要生成 —— 章节内容更新后自动调一次，存入 chapters.summary
// =============================================================================

/**
 * 调一次 DeepSeek，让模型对章节正文生成一段 100~200 字的总结。
 * 用于"前文摘要"上下文构建。
 */
export async function generateSummary(
  fullText: string,
  opts: { apiKey?: string; signal?: AbortSignal; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = (opts.apiKey ?? getApiKey()).trim();
  if (!apiKey) {
    throw new DeepSeekError(
      'no_api_key',
      '尚未配置 DeepSeek API Key，请前往「设置」页面录入。',
    );
  }
  const trimmed = fullText.trim().slice(0, 6000); // 控制 prompt 长度
  if (!trimmed) return '';

  const systemPrompt =
    '你是一名严谨的编辑。请阅读以下小说章节正文，用中文给出 80~150 字的客观摘要。' +
    '要求：1) 以第三人称叙述；2) 包含主要出场人物 + 核心情节推进；3) 不要点评、不要续写。';

  const userPrompt = `【章节正文】\n${trimmed}\n\n【摘要】`;

  const res = await fetch(getApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: opts.maxTokens ?? 512,
      temperature: 0.4,
    }),
    signal: opts.signal,
  }).catch((err) => {
    if ((err as Error)?.name === 'AbortError') {
      throw new DeepSeekError('aborted', '请求已取消', { cause: err });
    }
    if (isCorsLikely(err)) {
      throw new DeepSeekError('cors', '浏览器 CORS 拦截，请装扩展或换网络。', {
        cause: err,
      });
    }
    throw new DeepSeekError('network', `网络错误：${(err as Error)?.message}`, {
      cause: err,
    });
  });

  if (!res.ok) {
    await throwForHttpError(res);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  return content.trim();
}