# VOLANS — Cloud Run デプロイ手順

## 前提
- GCP プロジェクト（例: `archi-prisma-volans`）を作成済み
- Artifact Registry に `volans` リポジトリ（Docker）を作成
  ```bash
  gcloud artifacts repositories create volans \
    --repository-format=docker \
    --location=asia-northeast1
  ```
- Cloud Build サービスアカウントに以下のロール付与:
  - `roles/run.admin`
  - `roles/artifactregistry.writer`
  - `roles/iam.serviceAccountUser`

## 初回デプロイ
```bash
cd D:/senaa_dev/volume-check
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=volans-web,_REGION=asia-northeast1
```
完了後、Cloud Run コンソールに `volans-web` が表示される。

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

セキュリティルールは `firestore.rules` に同梱。初回 deploy:
```bash
firebase init firestore  # rulesFile を firestore.rules に指定
firebase deploy --only firestore:rules
```
ルールの要点：`users/{uid}/volansProjects/{id}` は `request.auth.uid == uid` のみ read/write 可、その他は全面 deny。

## 参考
- Next.js 16 + Turbopack が `output: 'standalone'` を未サポートなため、現状の Docker イメージは `node_modules` + `.next` を丸ごと同梱（約 250–350 MB）。Turbopack が standalone を吐き出せるようになったら Dockerfile の runtime ステージを slim 化する。
- ディレクトリ改名 (`volume-check` → `volans`) は手動で実施予定。改名後は `package.json` の `"name"` も `volans` に更新推奨。
- Gemini API キーは `--set-secrets` 経由で注入（`cloudbuild.yaml` 参照）。
