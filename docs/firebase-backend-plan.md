# Firebase 後端規劃

> 規劃文件，尚未實作。目前全站仍是 mock／localStorage（見 CLAUDE.md「尚未完成」）。
> 供之後接線時參考。

## 決定總覽

| 用途 | 用什麼 | 狀態 |
|---|---|---|
| 登入／會員／忘記密碼 | **Firebase Authentication** | 待接線 |
| 資料庫（設備／訂單／空間／同學狀態） | **Cloud Firestore** | 待接線 |
| 圖片（設備照、憑證、押金收據等） | **Firebase Storage** | 待接線 |
| 後台 GUI（看同學狀態、上傳圖片） | 見下方「後台 GUI」一節 | 待決定 |
| 網站 Hosting | **維持 Vercel**（`vercel.json` 已設好，不搬家） | 現行 |

Firebase 只當「後端服務」，前端照現在 Vercel 部署，兩者並存。

## 為什麼是 Firestore（不是 Realtime Database）

資料是結構化、要查詢的：設備庫存、訂單記錄、空間佔用時段、衝突檢查。
Firestore 的 collection/document + 查詢適合這種場景；Realtime Database 適合即時同步的扁平 JSON（聊天、遊戲），用在這裡會綁手綁腳。

## 圖片處理

- 圖片檔存 **Firebase Storage**，Firestore 只存下載 URL（字串）。
- 例：設備文件 `equipment/{id}` 存 `imageUrl`，實體檔在 Storage `equipment-images/{id}.jpg`。
- Storage 有內建 GUI，可直接看到縮圖預覽。

## 後台 GUI（重點需求：可視化、上傳圖片、看每個同學狀態）

需求是「GUI 可視化的資料庫，可以上傳圖片，看到每個同學的狀態」。三條路，由懶到重：

1. **Firebase Console（免費、現成）** — 可瀏覽／編輯 Firestore 文件、Storage 看縮圖。
   但它是文件樹（開發者導向），不是試算表；給系辦人員每天用不夠友善。

2. **第三方 Firestore GUI／CMS（推薦，省得自己做管理後台）** —
   - **Rowy** 或 **FireCMS**：在 Firestore 上直接給你「試算表式」介面，
     欄位支援圖片上傳、可一列一列看每個同學／每筆訂單的狀態，低程式碼。
   - 直接滿足「可視化 + 上傳圖片 + 看同學狀態」，不必自建 `管理後台`。

3. **自建管理後台（最重）** — CLAUDE.md 已列為「完全沒有」的缺口。
   等 Rowy／FireCMS 真的不合用（例如要客製審核流程、押金確認、歸還標記）再做。

> ponytail 建議：先試 Rowy／FireCMS，別急著自建管理後台。

## 忘記密碼（自助重設）

- 目標：用 Firebase Auth 的 `sendPasswordResetEmail`，取代 [HomePage.tsx](../src/pages/HomePage.tsx) 目前「請聯繫系辦」的靜態 Modal。
- **坑**：現行帳號綁「學號」（`mockApiLogin`，`src/utils/testAuthData.ts`），
  但 Firebase Auth 重設信綁 **email**。接線時要先建立「學號 ↔ email」對應，重設信才寄得出去。

## 接線點（架構已預留，不必重構）

- 認證：`AuthProvider` 的 `authService` prop（`AuthService` 介面），換掉 `mockApiLogin` 即可。
- Storage key：`src/utils/storageKeys.ts` 已集中管理。
- 換 mock 為 Firebase 的清單（CLAUDE.md「尚未完成」）：
  登入、設備庫存扣減（`EquipmentGrid.tsx`）、空間佔用（`SpaceAreaMap.tsx`）、
  通知（Header）、送單（`useOrderSubmission` 只寫 localStorage receipts）。

## Firestore 資料模型草稿（待細化）

```
users/{studentId}          # 學號、姓名、email、身分、狀態
equipment/{id}             # 名稱、分類、庫存、imageUrl
orders/{orderId}           # studentId、品項、日期、狀態（待審/借出/歸還）、押金狀態
spaceBookings/{bookingId}  # 區域、時段、studentId、狀態
notifications/{id}         # studentId、內容、已讀
```

## 下一步

要開始時：先定案 Firestore schema → 建 collection → 逐一把 mock 換成 Firestore 讀寫。
