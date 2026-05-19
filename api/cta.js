import { appendRow, decodeToken } from './_sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.redirect(302, '/interest.html');

  const body =
    typeof req.body === 'string'
      ? Object.fromEntries(new URLSearchParams(req.body))
      : req.body;

  const company = body.company?.trim() || '（未入力）';
  const phone = body.phone?.trim() || '（未入力）';

  // メール経由のトラッキング識別子（interest.html の hidden field から POST される）
  const u = (body.u || '').trim();
  const c = (body.c || '').trim();
  const utmSource = (body.utm_source || '').trim();
  const utmMedium = (body.utm_medium || '').trim();
  const utmCampaign = (body.utm_campaign || '').trim();
  const decodedEmail = decodeToken(u);

  // Slack通知
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      const fields = [
        { type: 'mrkdwn', text: `*会社名:*\n${company}` },
        { type: 'mrkdwn', text: `*電話番号:*\n${phone}` },
      ];
      if (c || decodedEmail) {
        fields.push({
          type: 'mrkdwn',
          text: `*キャンペーン:*\n${c || '（直接アクセス）'}`,
        });
        fields.push({
          type: 'mrkdwn',
          text: `*メール経由:*\n${decodedEmail || '（不明）'}`,
        });
      }
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: '📩 メール「興味あり」クリック' },
            },
            { type: 'section', fields },
          ],
        }),
      });
    } catch (e) {
      console.error('Slack notification failed:', e);
    }
  }

  // Sheets の Clicks シートに追記（非同期・失敗してもフローは続行）
  if (u || c) {
    appendRow('Clicks', [
      new Date().toISOString(),
      c,
      u,
      decodedEmail,
      company,
      phone,
      utmSource,
      utmMedium,
      utmCampaign,
    ]).catch((err) => {
      console.error('Sheets append (Clicks) failed:', err.message);
    });
  }

  return res.redirect(302, '/thanks.html');
}
