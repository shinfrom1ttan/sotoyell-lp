/**
 * 開封トラッキングピクセル
 *
 * クエリ: ?u=<base64url email>&c=<campaign_id>
 * 動作: 1x1 透明 GIF を返却 + Sheets の "Opens" シートに 1行追記
 *
 * 注意:
 *   - Gmail は受信時に Google Image Proxy でピクセルを fetch するため、
 *     開封されていなくても「初回ロード」が記録されることがある。
 *     UserAgent に GoogleImageProxy が入る場合は preload と判定推奨。
 */

import { appendRow, decodeToken } from '../_sheets.js';

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': String(PIXEL.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
  Pragma: 'no-cache',
  Expires: '0',
};

export default async function handler(req, res) {
  const u = (req.query?.u || '').toString();
  const c = (req.query?.c || '').toString();
  const ua = req.headers['user-agent'] || '';
  const ip =
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';

  // 非同期で書き込み（ピクセル応答を遅延させない）
  appendRow('Opens', [
    new Date().toISOString(),
    c,
    u,
    decodeToken(u),
    ua,
    ip,
    /GoogleImageProxy/i.test(ua) ? 'proxy' : 'client',
  ]).catch((err) => {
    console.error('Sheets append (Opens) failed:', err.message);
  });

  // ピクセル返却
  for (const [k, v] of Object.entries(PIXEL_HEADERS)) res.setHeader(k, v);
  res.status(200).end(PIXEL);
}
