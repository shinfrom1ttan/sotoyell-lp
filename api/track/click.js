/**
 * クリックトラッキング（CTA → LP 到達）
 *
 * クエリ: ?u=<base64url email>&c=<campaign_id>
 * 動作: 1x1 透明 GIF を返却 + Sheets の "Clicks" シートに 1行追記
 *
 * 呼び出し元: interest.html の onload で fetch（fire-and-forget）
 * 注意:
 *   - 同一受信者が複数回 LP に訪問する場合、複数行が記録される（ユニーク化は集計時）
 *   - `<img>` でも `fetch(no-cors)` でも呼べる（GET なら何でも）
 */

import { appendRow, decodeToken } from '../_sheets.js';

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
  'Access-Control-Allow-Origin': '*',
};

export default async function handler(req, res) {
  const u = (req.query?.u || '').toString();
  const c = (req.query?.c || '').toString();
  const ua = req.headers['user-agent'] || '';
  const ip =
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';
  const referer = req.headers['referer'] || req.headers['referrer'] || '';

  // Sheets 書き込みを await（res.end() 後の Promise は実行保証されないため）
  const utmSource = (req.query?.utm_source || '').toString();
  const utmMedium = (req.query?.utm_medium || '').toString();
  const utmCampaign = (req.query?.utm_campaign || '').toString();

  try {
    await appendRow('Clicks', [
      new Date().toISOString(),
      c,
      u,
      decodeToken(u),
      '', // company は空欄（LP到達時点では未取得）
      '', // phone も空欄
      utmSource,
      utmMedium,
      utmCampaign,
      ua,
      ip,
      referer,
    ]);
  } catch (err) {
    console.error('Sheets append (Clicks landing) failed:', err.message);
  }

  for (const [k, v] of Object.entries(PIXEL_HEADERS)) res.setHeader(k, v);
  res.status(200).end(PIXEL);
}
