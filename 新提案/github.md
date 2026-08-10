repo: yoichi-project01/Pokelids-collect
branch: master
path: apps/mobile

## Last sync

date: 2026-08-10T04:17:50Z

### Updated in this project

- 現状UI（7画面）を theme.ts / (tabs) / prefectures / poke-lids のソースから再現
- アクセシビリティ改善案（本文17px以上・状態を色以外でも表現・タップ領域56px以上）を追加
- 現状と改善案を1つのキャンバスで並べて比較できる形に整理

## Screen map

| 画面 | 参照したリポジトリのファイル |
| --- | --- |
| ホーム（収集進捗） | apps/mobile/app/(tabs)/index.tsx, src/components/ProgressBar.tsx, src/components/ListRow.tsx, src/components/ScreenContainer.tsx, src/theme.ts |
| タブバー / ヘッダー | apps/mobile/app/(tabs)/_layout.tsx, app/_layout.tsx, src/components/AppHeader.tsx |
| 都道府県別一覧 | apps/mobile/app/prefectures/[id].tsx, src/components/PokeLidCard.tsx, src/components/FilterChip.tsx, src/lib/useGridData.ts |
| 地図 | apps/mobile/app/(tabs)/map.web.tsx, src/lib/mapHtml.ts, src/components/MapRefreshButton.tsx |
| コレクション | apps/mobile/app/(tabs)/collection.tsx, src/lib/medal.ts |
| ポケふた詳細 | apps/mobile/app/poke-lids/[id].tsx, src/components/Button.tsx, src/components/TextField.tsx |
| 設定 | apps/mobile/app/(tabs)/settings.tsx, src/lib/medal.ts |
| ログイン | apps/mobile/app/login.tsx, src/components/PasswordField.tsx, src/components/TextField.tsx |
