# GitHub Pages へのデプロイ手順

## 1. GitHubでリポジトリを作成

1. https://github.com/new にアクセス
2. リポジトリ名: `ai-consult-crm`（任意）
3. Public を選択
4. **「Add a README file」はチェックしない**（既にローカルにあるため）
5. Create repository をクリック

## 2. ローカルからプッシュ

```bash
cd c:\Users\hiron\Documents\GitHub\ai-consult-crm

# リモートを追加
git remote add origin https://github.com/hironori12140/ai-consult-crm.git

# プッシュ
git branch -M main
git push -u origin main
```

## 3. GitHub Pages を有効化

1. リポジトリの **Settings** → **Pages**
2. **Source**: `GitHub Actions` を選択
3. 保存（初回プッシュ後、自動でデプロイが開始されます）

## 4. 公開URL

デプロイ完了後（数分かかることがあります）:
```
https://hironori12140.github.io/ai-consult-crm/
```
