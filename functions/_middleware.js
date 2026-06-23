// Cloudflare Pages Functions middleware.
//
// Why this file exists even though `dist/_headers` and `dist/_redirects`
// are also present:
//   - We want explicit control over Content-Type for hashed asset paths,
//     because Cloudflare's MIME inference occasionally returns
//     `application/octet-stream` for them, which breaks `<script type="module">`
//     loading (Strict MIME type checking per HTML spec).
//   - We still fall back to `index.html` for SPA routing, but only when the
//     requested asset is actually missing (404), not for every navigation.
//
// Reference: https://developers.cloudflare.com/pages/functions/middleware/

/** @type {Record<string, string>} */
const MIME_BY_EXT = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function detectMime(pathname) {
  const lower = pathname.toLowerCase();
  // Use lastIndexOf to handle paths like "/foo/bar.js?v=1" (although we don't
  // get query here, this is defensive).
  for (const ext in MIME_BY_EXT) {
    if (lower.endsWith(ext)) return MIME_BY_EXT[ext];
  }
  return null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const detected = detectMime(pathname);

  const upstream = await context.next();

  // Build a mutable copy of headers. The Response returned by context.next()
  // may have its headers locked once the body starts streaming, so we always
  // construct a new Response to be safe.
  const headers = new Headers(upstream.headers);

  // 1. Force a correct Content-Type for known asset extensions, even when
  //    Cloudflare's MIME inference returned octet-stream.
  if (detected) {
    headers.set('Content-Type', detected);
  }

  // 2. SPA fallback: if an asset route 404'd, serve index.html with a 200.
  if (upstream.status === 404) {
    const indexResponse = await context.env.ASSETS.fetch(
      new URL('/index.html', context.request.url),
    );
    const indexHeaders = new Headers(indexResponse.headers);
    indexHeaders.set('Content-Type', 'text/html; charset=utf-8');
    indexHeaders.set('Cache-Control', 'no-cache');
    return new Response(indexResponse.body, {
      status: 200,
      headers: indexHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
