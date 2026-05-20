# メール配信トラッキング 設定

ソトエル一斉メール配信（`scripts/sotoyell_bulk_mailer/`）の開封・クリック・コンバージョンを記録するための Vercel 側エンドポイント。

## エンドポイント / ファネル設計

| ファネル段階 | パス | 役割 | 記録先シート |
|-------------|------|------|--------------|
| 1. 開封 | `GET /api/track/open?u=<token>&c=<campaign>` | 開封ピクセル（1x1 GIF返却） | `Opens` |
| 2. CTAクリック→LP到達 | `GET /api/track/click?u=<token>&c=<campaign>&utm_*` | LP 到達ピクセル（1x1 GIF返却） | `Clicks` |
| 3. コンバージョン | `POST /api/cta` | フォーム送信（会社名・電話番号） | `Conversions` |

集計式:
- **開封率** = `COUNT(DISTINCT token) of Opens` ÷ 配信数
- **クリック率（CTR）** = `COUNT(DISTINCT token) of Clicks` ÷ 配信数
- **コンバージョン率** = `COUNT(*) of Conversions` ÷ クリック数

## 必要な環境変数

| 変数名 | 値の例 / 内容 |
|--------|---------------|
| `SLACK_WEBHOOK_URL` | 既存。CTA フォーム送信時の Slack 通知用 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `xxx@yyy.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Service Account の秘密鍵（PEM全文）。`\n` はそのまま文字列で OK |
| `TRACKING_SHEET_ID` | 配信マスタスプシの ID（URL の `/d/<ID>/edit` 部分） |

### Service Account の準備手順

1. Google Cloud Console → プロジェクト選択 → **APIs & Services → Credentials**
2. **Create Credentials → Service Account** → 名前は `sotoyell-tracking` などで作成
3. **Keys → Add Key → JSON** で鍵を生成・ダウンロード
4. ダウンロードした JSON ファイルから以下を Vercel 環境変数に貼り付け：
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`（`\n` 含む文字列のまま、または実改行のままでも可）
5. **Google Sheets API を有効化**: Cloud Console → APIs & Services → Library → "Google Sheets API" → Enable
6. **配信マスタスプシ** を開き、上記 `client_email` を **編集者** として共有（通知メールは送信しない設定）

## スプレッドシート側の準備（Opens / Clicks / Conversions の 3シート）

`配信マスタ` スプシに以下を準備（初回のみ）。

### `Opens` シート（A1 行）

| timestamp | campaign_id | token | email | user_agent | ip | type |
|-----------|-------------|-------|-------|------------|-----|------|

- `type` は `client`（実ブラウザ）/ `proxy`（Gmail Image Proxy）の区別

### `Clicks` シート（A1 行）

| timestamp | campaign_id | token | email | company | phone | utm_source | utm_medium | utm_campaign |

- `company` / `phone` は空欄（LP 到達時点では未取得）
- 末尾に user_agent / ip / referer も追記される（J/K/L 列、ヘッダ無くてもOK）

### `Conversions` シート（A1 行）

| timestamp | campaign_id | token | email | company | phone | utm_source | utm_medium | utm_campaign |

- `company` / `phone` は実フォーム入力値

## 動作確認

ローカルで `vercel dev` 起動後（要 Vercel CLI）:

```bash
# 1. 開封ピクセル → Opens シート
curl -i "http://localhost:3000/api/track/open?u=c2hpbi5ha2Fob3JpQDF0dGFuLmpw&c=test_campaign"

# 2. CTA → LP 到達 → Clicks シート
curl -i "http://localhost:3000/api/track/click?u=c2hpbi5ha2Fob3JpQDF0dGFuLmpw&c=test_campaign&utm_source=email"

# 3. フォーム送信 → Conversions シート
curl -i -X POST "http://localhost:3000/api/cta" \
  -d "company=テスト&phone=090-0000-0000&u=c2hpbi5ha2Fob3JpQDF0dGFuLmpw&c=test_campaign&utm_source=email"
```

各シートに 1行ずつ追加されることを確認。

## interest.html 側の動き

ページロード時に：
1. URL クエリ（`?u=&c=&utm_*`）を hidden field に転記
2. `u` と `c` が含まれていれば、`new Image().src = '/api/track/click?...'` で fire-and-forget で計測
3. ユーザーがフォーム送信 → POST `/api/cta` → Conversions シートへ

## Gmail Image Proxy について

Gmail は受信時に Google の Image Proxy 経由でピクセルを fetch する。そのため：
- 受信者が実際に開封していなくても、Gmail サーバー側で 1回 fetch される（プリロード）
- `Opens.type = proxy` の行は受信時の preload、`type = client` は実機での実開封の可能性が高い
- 集計時は `type = client` のみカウントするか、`COUNT(DISTINCT token)` でユニーク開封率を出すのが実用的
