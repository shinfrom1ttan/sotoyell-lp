# メール配信トラッキング 設定

ソトエル一斉メール配信（`scripts/sotoyell_bulk_mailer/`）からの開封・クリックを記録するための Vercel 側エンドポイント。

## エンドポイント

| パス | 役割 | 記録先シート |
|------|------|--------------|
| `GET /api/track/open?u=<token>&c=<campaign>` | 開封ピクセル（1x1 GIF返却） | `Opens` |
| `POST /api/cta` | CTA フォーム送信（既存・クリック計測拡張済） | `Clicks` |

両エンドポイントは Google Sheets API でスプシに行を追記する。

## 必要な環境変数（Vercel ダッシュボード or `vercel env add`）

| 変数名 | 値の例 / 内容 |
|--------|---------------|
| `SLACK_WEBHOOK_URL` | 既存。CTA クリック通知用 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `xxx@yyy.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Service Account の秘密鍵（PEM全文）。`\n` はそのまま文字列で OK |
| `TRACKING_SHEET_ID` | 配信マスタスプシの ID（URL の `/d/<ID>/edit` 部分） |

### Service Account の準備手順

1. Google Cloud Console → プロジェクト選択 → **APIs & Services → Credentials**
2. **Create Credentials → Service Account** → 名前は `sotoyell-tracking` などで作成
3. **Keys → Add Key → JSON** で鍵を生成・ダウンロード
4. ダウンロードした JSON ファイルから以下を Vercel 環境変数に貼り付け：
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`（`\n` 含む文字列のまま）
5. **Google Sheets API を有効化**: Cloud Console → APIs & Services → Library → "Google Sheets API" → Enable
6. **配信マスタスプシ** を開き、上記 `client_email` を **編集者** として共有

既存の `ttan-automation` Service Account を再利用する場合は、新規鍵を発行して同じ手順で OK。

## スプレッドシート側の準備（Opens / Clicks シート）

`配信マスタ` スプシに以下2シートを追加（初回のみ）。

### `Opens` シート（A1 行）

| timestamp | campaign_id | token | email | user_agent | ip | type |
|-----------|-------------|-------|-------|------------|-----|------|
| 2026-... | reach_20260512 | c2hpb... | shin.akahori@1ttan.jp | Mozilla/... | 1.2.3.4 | client / proxy |

### `Clicks` シート（A1 行）

| timestamp | campaign_id | token | email | company | phone | utm_source | utm_medium | utm_campaign |

## 動作確認

ローカルで `vercel dev` 起動後（要 Vercel CLI）:

```bash
# 開封ピクセル
curl -i "http://localhost:3000/api/track/open?u=c2hpbi5ha2Fob3JpQDF0dGFuLmpw&c=test_campaign"
# → 200 + image/gif

# CTA（フォーム送信を模擬）
curl -i -X POST "http://localhost:3000/api/cta" \
  -d "company=テスト&phone=090-0000-0000&u=c2hpbi5ha2Fob3JpQDF0dGFuLmpw&c=test_campaign&utm_source=email"
# → 302 /thanks.html
```

両方とも Opens / Clicks シートに行が追加されることを確認。

## Gmail Image Proxy について

Gmail は受信時に Google の Image Proxy 経由でピクセルを fetch する。
そのため：
- 受信者が実際に開封していなくても、Gmail サーバー側で 1回 fetch される（プリロード）
- ただし正確な開封カウントの目安にはなる（多くの実装が同様）
- `Opens.type = proxy` の行は受信時の preload、`type = client` は実機での実開封の可能性が高い

集計時は両方を区別するか、`COUNT(DISTINCT token)` でユニーク開封率を出すのが実用的。
