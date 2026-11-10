# 學校 Google 帳號登入：後台設定步驟

學生用學校 Google 帳號登入（2026-10-24 定）。2026-11-10 確認 Supabase 已開 Google provider、接上 OAuth 用戶端，A–D 看起來已做完。
同日登入改用 Google 自己的按鈕（ID token），Google 畫面顯示本站網址、不再顯示 supabase.co（免買 Supabase 自訂網域）：**要補 C-2 的 `http://localhost` 和 D-5 的 Client ID 環境變數**，再做「E. 測試」。
後台帳號 `sccdsa` 要用學會 Gmail 登入，另外照「後台用 Gmail 登入」設定；學號＋密碼登入（登入頁 Google 鈕下方的「學號密碼登入」）不受影響。

- 規則與程式：`supabase/members-v2.sql`（資格判斷）、`src/services/authService.ts`（`renderGoogleButton` 畫 Google 按鈕、拿到 ID token 後 `signInWithGoogle`）
- Supabase 專案：`https://qhcgqdsfriyvkpjdwseu.supabase.co`

## 開始前

- **用哪個 Google 帳號建**：學會 Gmail 還沒申請好，先用個人 Gmail 建（2026-11-07 定），之後照「轉給學會 Gmail」轉過去。
  Client ID 和 secret 都不用換，學生不受影響。
- 不需要付費、不需要 Google 審核（只用 email、姓名這類基本權限）。

## A. 建立 Google Cloud 專案

1. 到 [console.cloud.google.com](https://console.cloud.google.com) 登入。
2. 左上角專案選單 → **New Project** → 名稱填 `SCCDSA Booking` → **Create**。

## B. 設定同意畫面

左側選單 **APIs & Services → OAuth consent screen**（新版介面叫 **Google Auth Platform**，點 **Get started**）。

1. **App name** 填 `SCCDSA Booking`；**User support email** 選目前登入的 Gmail。
2. **Audience** 選 **External**（學生是學校 Workspace 帳號，不是我們專案的組織內帳號）。
3. **Contact information** 填目前登入的 Gmail → 勾同意 → **Create**。
4. **Audience** 頁維持 *Testing* 就好，不用 Publish，也不用加 Test users：
   只要 email、姓名這類基本權限時，Google 不限 Test users，也沒有測試警告（Supabase 預設就只要這些）。
5. 到 **Branding** 頁，**Authorized domains** 加上 `qhcgqdsfriyvkpjdwseu.supabase.co`。
   **先不要上傳 logo**——上傳 logo 會觸發 Google 品牌審核（要好幾天）。

## C. 建立 OAuth 用戶端

**Clients → Create client**：

1. **Application type**：Web application；名稱隨意（例：`Supabase`）。
2. **Authorized JavaScript origins**：加 `http://localhost:3000`、`http://localhost`（本機測試 Google 按鈕兩個都要）和 Vercel 網址（`https://你的專案.vercel.app`，結尾不加斜線）。
   Google 按鈕只認這裡列的網址，換網域要回來加。
3. **Authorized redirect URIs**（舊的跳轉式登入用的，現在用不到，留著無妨）：
   ```
   https://qhcgqdsfriyvkpjdwseu.supabase.co/auth/v1/callback
   ```
4. 按 **Create** 後會顯示 **Client ID** 與 **Client secret**。
   **secret 只顯示這一次**，馬上複製或下載 JSON 存好（不要放進 git；忘了只能在同一頁新增一組 secret）。

## D. Supabase 設定

到 [Supabase Dashboard](https://supabase.com/dashboard) 的這個專案：

1. **Authentication → Sign In / Providers → Google**：開啟，貼上 Client ID 與 Client secret → **Save**。
2. **Authentication → URL Configuration**：
   - **Redirect URLs** 加 `http://localhost:3000/**` 和 `https://你的專案.vercel.app/**`（這裡沒有的網址，登入後會被導回 Site URL）
   - **Site URL** 改成 Vercel 網址
3. **Authentication → Sign In / Providers** 最上方的 **Allow new users to sign up** 要開著（第一次 Google 登入＝註冊）。
4. **SQL Editor** 貼上 `supabase/members-v2.sql` 執行（可重複執行）。
   不要跑 `supabase/google-login.sql`：它是舊版，會把「只有登記過的才能登入」蓋掉。
5. **環境變數**：`.env` 和 Vercel（Project → Settings → Environment Variables）加 `VITE_GOOGLE_CLIENT_ID`＝C-4 的 Client ID（範本見 `.env.example`；Client ID 可公開，secret 不要放）。
   Vercel 改完要重新部署才生效。D-1 填的就是同一組 Client ID，Supabase 會認這個按鈕拿到的 ID token，不用另外設。

## E. 測試

1. 先在後台會員管理「新增會員」登記要測試的學校帳號（沒登記的登不進來）。
2. `npm run dev`，在登入頁按 Google 的「使用 Google 帳戶繼續」鈕（瀏覽器已登入 Google 時會顯示「以 某某 的身分繼續」），Google 視窗應顯示 `localhost`、不是 supabase.co。
3. 用登記過的學校帳號（`學號@gm／gm1／gm2.usc.edu.tw`）→ 應直接進型錄；Profile 的班級、年級應已帶好。
4. 用非學校的 Gmail，或沒登記的學校帳號 → 應被擋下，登入頁顯示「請使用學校 Google 帳號…只有系學會登記過的帳號能登入」。
5. 到後台會員管理，確認帳號從「未啟用」變成已啟用。

## 選做：品牌審核

系上內部用不做（2026-11-07 定）。通過後 Google 登入頁才會顯示 `SCCDSA Booking`，沒做只是顯示本站網址（vercel.app），登入功能不受影響。要做的話：

   - 先在 **Branding** 填首頁和隱私權政策網址，再到 **Audience** 按 **Publish app**。
   - 要有自己的網域，並在 Search Console 驗證擁有權。`vercel.app` 有人回報過不了；學校子網域可能要驗證整個 `usc.edu.tw`。
   - 首頁要公開、不能只有登入畫面，要說明網站用途並連到隱私權政策；網站標題要跟 App name 完全一致。
   - **Authorized domains** 先放自己的網域、再放 Supabase；Google 問起時回覆 Supabase 是第三方服務。
   - 在 **Branding** 上傳 logo 送審，有時要往返幾封信。

## 常見問題

| 狀況 | 原因／處理 |
|---|---|
| 按鈕沒出現、顯示「無法連線到 Google」 | `VITE_GOOGLE_CLIENT_ID` 沒設（D-5），或網路擋了 accounts.google.com；瀏覽器 Console 有原因 |
| Google 視窗顯示 origin 不允許（`The given origin is not allowed`） | C-2 沒加這個網址；本機要 `http://localhost` 和 `http://localhost:3000` 都加 |
| 403 `access_denied`（不是自己按取消） | Supabase 的 Google 設定多加了基本權限以外的 scope，拿掉就好（有其他 scope 才受 Test users 限制） |
| 回到網站顯示「請使用學校 Google 帳號…」 | 網域不是學校的，或帳號還沒登記；該能借的人到會員管理「新增會員」登記 |
| LINE／IG 裡開網頁登不進去 | Google 不允許 App 內建瀏覽器登入；LINE 會自動改開外部瀏覽器，其他請學生用 Safari／Chrome |

## 後台用 Gmail 登入

後台用學會 Gmail 登入（2026-11-07 定：不用個人 Gmail 當後台）。學會 Gmail 申請好才做，步驟併在下面「轉給學會 Gmail」第 4 步；在那之前後台用學號 `sccdsa`＋密碼登入。

1. **SQL Editor** 把 `sccdsa` 帳號的 email 換成這個 Gmail，Google 登入才會接到同一個帳號（Gmail 不是學校網域，被當成新帳號會擋下）：
   ```sql
   update auth.users set email = '你的Gmail', email_confirmed_at = now()
     where id = (select id from public.students where student_id = 'sccdsa');
   update public.students set email = '你的Gmail' where student_id = 'sccdsa';
   ```
2. 登入頁按 Google 登入鈕、選這個 Gmail → 應該進後台（2FA 開回來後會先問驗證碼）。
   如果顯示「請使用學校 Google 帳號登入」，代表沒接到同一個帳號，先用學號密碼登入，別重複建帳號。
3. 學號密碼登入保留當備援（Google 故障時用），一樣要過 2FA。

**還沒實測**：Supabase 文件寫明同 email 會自動連結，但第 1 步是直接改資料表，要實際走一次才算數。

## 轉給學會 Gmail

學會 Gmail 申請好後做一次。Client ID 和 secret 不變，Supabase 的 Google 設定不用動，學生登入不受影響。

1. **加新擁有者**：用個人 Gmail 到 Google Cloud **IAM & Admin → IAM → Grant access**，填學會 Gmail、角色選 **Owner**。學會 Gmail 收到邀請信後要按接受。
2. **改聯絡信箱**：改用學會 Gmail 登入 Google Cloud，到 **Google Auth Platform → Branding** 把 User support email 和 Developer contact 改成學會 Gmail。
3. **移除個人帳號**：在 IAM 把個人 Gmail 移除。
4. **換後台帳號**：SQL Editor 執行下面三句，Gmail 要全部小寫。最後一句是清掉舊 Gmail 的連結，沒接過也可以跑：
   ```sql
   update auth.users set email = '學會Gmail', email_confirmed_at = now()
     where id = (select id from public.students where student_id = 'sccdsa');
   update public.students set email = '學會Gmail' where student_id = 'sccdsa';
   delete from auth.identities
     where provider = 'google'
       and user_id = (select id from public.students where student_id = 'sccdsa');
   ```
5. **實測**：個人 Gmail 按 Google 登入應被擋下，學會 Gmail 應進後台。

## 交接

- Google Cloud 專案：IAM 把下一屆的帳號加成 Owner，或直接交接學會 Google 帳號。
- Client secret 外洩或忘記：C 的同一個用戶端可新增一組 secret，貼到 D-1 後刪掉舊的。
- **後台帳號**（換屆必做，舊幹部才會失效）：① 改學會 Gmail 密碼 ② 改 `sccdsa` 密碼（改了舊裝置也會被登出）③ 重新綁定 2FA。
  順序不能反：不先改密碼，知道舊密碼的人可以搶先綁定。
- **重新綁定 2FA**（換屆、手機全部遺失、要加新手機時）：SQL Editor 執行下面這行，下次登入會出現新 QR，所有要值班的人一起重掃。
  QR 只在綁定時顯示，事後要加手機只能這樣重綁。
  ```sql
  delete from auth.mfa_factors where user_id = (select id from public.students where student_id = 'sccdsa');
  ```

## 待定

- **碩士**：學號 M 開頭，在會員管理登記就能登入，但年級不會自動帶，要自己填。
- **系學會費**：原則是借之前要先到學會確認繳費狀態，具體做法待定。
