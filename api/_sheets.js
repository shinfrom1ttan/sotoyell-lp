/**
 * Google Sheets API ヘルパー（Service Account JWT 認証）
 *
 * 必要な環境変数:
 *   - GOOGLE_SERVICE_ACCOUNT_EMAIL: Service Account のメールアドレス
 *   - GOOGLE_PRIVATE_KEY: Service Account の秘密鍵（PEM形式、\n はそのまま文字列で OK）
 *   - TRACKING_SHEET_ID: 記録先スプレッドシートのID
 *
 * 依存パッケージはゼロ（node:crypto と fetch のみ使用）
 */

import crypto from 'node:crypto';

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY が未設定');
  }
  const key = rawKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${b64url(header)}.${b64url(claim)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer
    .sign(key)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function appendRow(sheetName, row) {
  const sheetId = process.env.TRACKING_SHEET_ID;
  if (!sheetId) throw new Error('TRACKING_SHEET_ID が未設定');
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets append failed: ${res.status} ${text}`);
  }
}

/**
 * base64url でエンコードされた email を復号する
 */
export function decodeToken(token) {
  if (!token) return '';
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    const fixed = pad ? padded + '='.repeat(4 - pad) : padded;
    return Buffer.from(fixed, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}
