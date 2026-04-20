# VOLANS — Cloud Run デプロイ手順

本プロジェクトは GCP プロジェクト **`volans-web`** にデプロイする前提。以下は
実際に実行した初回セットアップを再現できるプレイブック。

## 0. 初回セットアップ（2026-04-20 実施済み）

```bash
# Firebase + GCP プロジェクトを同時作成
firebase projects:create volans-web --display-name "VOLANS"

# 以降のコマンドは volans-web を対象
firebase use volans-web
gcloud config set project volans-web

# Firestore を asia-northeast1（東京）にプロビジョン
gcloud services enable firestore.googleapis.com
firebase firestore:databases:create '(default)' --location=asia-northeast1

# セキュリティルールを deploy
firebase deploy --only firestore:rules

# Web アプリ登録 → .env.local に書き込む config を取得
firebase apps:create WEB "VOLANS Web"
firebase apps:sdkconfig WEB <APP_ID>
```

Firebase アプリの設定は `.env.local`（gitignore）に書き込む：

```
NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=volans-web
NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
```

## 1. Cloud Run 初回デプロイの前提

Billing account を `volans-web` に紐付ける（初回のみ）:

```bash
gcloud beta billing projects link volans-web \
  --billing-account=<BILLING_ACCOUNT_ID>
```

**quota exceeded になったら**: Google Cloud Billing quota の引き上げを
https://support.google.com/code/contact/billing_quota_increase から申請。
2営業日以内に返信 → 1時間で有効化。

必要な API を有効化:
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
                       cloudbuild.googleapis.com secretmanager.googleapis.com \
                       --project=volans-web
```

Artifact Registry に `volans` リポジトリを作成:
```bash
gcloud artifacts repositories create volans \
  --repository-format=docker \
  --location=asia-northeast1
```

Cloud Build サービスアカウントに以下のロール付与:
- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/iam.serviceAccountUser`
- `roles/secretmanager.secretAccessor`（Gemini key 注入用）

Gemini API キーを Secret Manager に登録:
```bash
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
```

## 2. 初回デプロイ

```bash
cd D:/senaa_dev/volume-check
./scripts/deploy-volans.sh volans-web
```
完了後、Cloud Run コンソールに `volans-web` サービスが表示される。

## 環境変数
ローカルでは `.env.local` に格納。本番では Secret Manager を推奨:
```bash
# 一度だけ
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# Cloud Run に secret を注入
gcloud run services update volans-web \
  --region=asia-northeast1 \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

## 独自ドメイン
```bash
gcloud run domain-mappings create --service=volans-web \
  --domain=volans.archi-prisma.co.jp --region=asia-northeast1
```
その後、DNS の CNAME を案内値に設定。

## ローカルで Docker 動作確認
```bash
docker build -t volans-local .
docker run --rm -p 8080:8080 -e GEMINI_API_KEY=xxx volans-local
# → http://localhost:8080
```

## Firebase Auth / Firestore（クラウド同期）
VOLANS はクラウド保存をオプショナル機能として提供。`.env.local` に `NEXT_PUBLIC_FIREBASE_*` 4点を設定するとヘッダのサインイン UI が有効化される。

セキュリティルールは `firestore.rules` に同梱（§0 で既に deploy 済み）。ルール変更後は：
```bash
firebase deploy --only firestore:rules --project=volans-web
```
ルールの要点：`users/{uid}/volansProjects/{id}` は `request.auth.uid == uid` のみ read/write 可、その他は全面 deny。

**サインイン プロバイダの有効化（Console 手動 — CLI 不可）**

Firebase Auth の Google/Anonymous プロバイダは https://console.firebase.google.com/project/volans-web/authentication/providers から：
1. **Google** → 有効にする → サポートメール（`s.sakuramoto@archi-prisma.co.jp` 等）→ 保存
2. **Anonymous**（任意、ゲスト用）→ 有効にする → 保存

これで `/sky` のサインインボタンから実サインインが動作し、Firestore 同期まで通る。

## 参考
- Next.js 16 + Turbopack が `output: 'standalone'` を未サポートなため、現状の Docker イメージは `node_modules` + `.next` を丸ごと同梱（約 250–350 MB）。Turbopack が standalone を吐き出せるようになったら Dockerfile の runtime ステージを slim 化する。
- ディレクトリ改名 (`volume-check` → `volans`) は手動で実施予定。改名後は `package.json` の `"name"` も `volans` に更新推奨。
- Gemini API キーは `--set-secrets` 経由で注入（`cloudbuild.yaml` 参照）。
