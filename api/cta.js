export default async function handler(req, res) {
  if (req.method !== 'POST') return res.redirect(302, '/interest.html');

  const body =
    typeof req.body === 'string'
      ? Object.fromEntries(new URLSearchParams(req.body))
      : req.body;

  const company = body.company?.trim() || '（未入力）';
  const phone = body.phone?.trim() || '（未入力）';

  // Slack通知
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: '\ud83d\udce9 \u30e1\u30fc\u30eb\u300c\u8208\u5473\u3042\u308a\u300d\u30af\u30ea\u30c3\u30af' },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*\u4f1a\u793e\u540d:*\n${company}` },
                { type: 'mrkdwn', text: `*\u96fb\u8a71\u756a\u53f7:*\n${phone}` },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      console.error('Slack notification failed:', e);
    }
  }

  return res.redirect(302, '/thanks.html');
}
