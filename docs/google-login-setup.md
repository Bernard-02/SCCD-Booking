# 學校 Google 帳號登入：後台設定步驟

學生用學校 Google 帳號登入（2026-10-24 定），程式與 SQL 已寫好，**只差這份文件的一次性設定**。
設定完成前，登入頁的「使用學校 Google 帳號登入」按了會失敗；後台帳號 `sccdsa` 的學號＋密碼登入不受影響。

- 規則與程式：`supabase/google-login.sql`（資格判斷）、`src/services/authService.ts`（`signInWithGoogle`／`finishGoogleLogin`）
- Supabase 專案：`https://qhcgqdsfriyvkpjdwseu.supabase.co`

## 開始前

- **用哪個 Google 帳號建**：建議用系學會的共用 Google 帳號，換屆時把帳號交接下去就好。
  目前還沒有學會信箱，可以先申請一個（例如 Gmail）再來設定；用個人帳號也能動，但交接時要把專案擁有者轉給下一屆。
- 不需要付費、不需要 Google 審核（只用 email、姓名這類基本權限）。

## A. 建立 Google Cloud 專案

1. 到 [console.cloud.google.com](https://console.cloud.google.com) 登入。
2. 左上角專案選單 → **New Project** → 名稱填 `SCCDSA Booking` → **Create**。

## B. 設定同意畫面

左側選單 **APIs & Services → OAuth consent screen**（新版介面叫 **Google Auth Platform**，點 **Get started**）。

1. **App name** 填 `SCCDSA Booking`；**User support email** 選學會信箱。
2. **Audience** 選 **External**（學生是學校 Workspace 帳號，不是我們專案的組織內帳號）。
3. **Contact information** 填學會信箱 → 勾同意 → **Create**。
4. 到 **Audience** 頁，Publishing status 從 *Testing* 按 **Publish app** 改成 *In production*。
   不改的話只有手動加進 Test users 的人能登入，其他人會看到 403 access_denied。
5. 到 **Branding** 頁，**Authorized domains** 加上 `qhcgqdsfriyvkpjdwseu.supabase.co`。
   **先不要上傳 logo**——上傳 logo 會觸發 Google 品牌審核（要好幾天）。

## C. 建立 OAuth 用戶端

**Clients → Create client**：

1. **Application type**：Web application；名稱隨意（例：`Supabase`）。
2. **Authorized JavaScript origins**：加 `http://localhost:3000`；正式網址上線後再加正式網址。
3. **Authorized redirect URIs**：
   ```
   https://qhcgqdsfriyvkpjdwseu.supabase.co/auth/v1/callback
   ```
4. 按 **Create** 後會顯示 **Client ID** 與 **Client secret**。
   **secret 只顯示這一次**，馬上複製或下載 JSON 存好（不要放進 git；忘了只能在同一頁新增一組 secret）。

## D. Supabase 設定

到 [Supabase Dashboard](https://supabase.com/dashboard) 的這個專案：

1. **Authentication → Sign In / Providers → Google**：開啟，貼上 Client ID 與 Client secret → **Save**。
2. **Authentication → URL Configuration**：
   - **Redirect URLs** 加 `http://localhost:3000/**`
   - 正式網址上線後：**Site URL** 改成正式網址，**Redirect URLs** 再加 `https://正式網址/**`
3. **Authentication → Sign In / Providers** 最上方的 **Allow new users to sign up** 要開著（第一次 Google 登入＝註冊）。
4. **SQL Editor** 貼上 `supabase/google-login.sql` 執行（可重複執行）。

## E. 測試

1. `npm run dev`，在登入頁按「使用學校 Google 帳號登入」。
2. 用本系學校帳號（`學號@gm／gm1／gm2.usc.edu.tw`）→ 應直接進型錄；Profile 的班級、年級應已帶好。
3. 用非學校的 Gmail → 應被擋下，登入頁顯示「請使用本系學生的學校 Google 帳號登入」。
4. 到後台會員管理，確認剛剛的帳號出現在名單裡。

## 常見問題

| 狀況 | 原因／處理 |
|---|---|
| Google 頁面顯示 `redirect_uri_mismatch` | C-3 的 redirect URI 沒填或打錯，要跟上面完全一樣 |
| 403 `access_denied`（不是自己按取消） | B-4 沒有 Publish，還在 Testing |
| 回到網站顯示「請使用本系學生的學校 Google 帳號登入」 | 網域或學號不符規則；該能借的人到會員管理「登入例外名單」加學號 |
| LINE／IG 裡開網頁登不進去 | Google 不允許 App 內建瀏覽器登入；LINE 會自動改開外部瀏覽器，其他請學生用 Safari／Chrome |
| 跳回 `localhost` 或錯的網址 | D-2 的 Redirect URLs／Site URL 沒設對 |

## 交接

- Google Cloud 專案：IAM 把下一屆的帳號加成 Owner，或直接交接學會 Google 帳號。
- Client secret 外洩或忘記：C 的同一個用戶端可新增一組 secret，貼到 D-1 後刪掉舊的。

## 待定

- **碩士**：學號 M 開頭，格式確認後可加進 `google-login.sql` 的自動規則；在那之前用例外名單。
- **系學會費**：原則是借之前要先到學會確認繳費狀態，具體做法待定。
