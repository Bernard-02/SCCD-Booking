# 大量訂單核對單存到學會 Google Drive：設定步驟

後台訂單頁的大量設備單有「核對單」鈕，按一下在學會 Drive 的資料夾建一份 Google 試算表（2026-11-08 學會會議，2026-11-09 學會決定用試算表，取代舊的 Excel 團體租借表單副本）。
學會直接在試算表上打勾、寫備註，系統內的訂單不受影響。

**設定完成前**，按鈕只會跳提示，其他功能不受影響。

- 程式：`src/services/adminService.ts`（`createCheckSheet`）、下面的 Apps Script
- 做法：Apps Script 以「部署帳號」的身分複製範本、填入訂單，不需要 Google Cloud 專案，值班的人也不用另外登入 Google。
- 權限：網址對外公開，但 Apps Script 會拿呼叫者的 Supabase 登入憑證查 `backend_access`，只有最高權限帳號與學會成員建得了檔。

## 開始前

用**對目標資料夾有編輯權限的帳號**操作，核對單會用這個帳號建立。可以先用開發者自己的帳號（學會把資料夾共用給開發者，權限選編輯者），**正式上線前**照下面「轉給學會帳號」換過去。

開一個**只登入這個帳號的瀏覽器視窗**（Chrome 新的使用者設定檔或無痕視窗）。同時登入多個 Google 帳號時，Apps Script 容易用錯帳號或授權失敗。

## 步驟

1. 在 Drive 開好要放核對單的資料夾（例：`大量訂單核對單`）。打開資料夾，網址 `folders/` 後面那一串就是**資料夾 ID**。
2. 到 [script.google.com](https://script.google.com) → **新專案**，名稱填 `SCCDSA 核對單上傳`。把下面的程式整段貼上，改最上面兩個常數，按 Ctrl+S：

   ```js
   const FOLDER_ID = '貼上資料夾 ID'
   const SUPABASE_ANON_KEY = '貼上 .env 的 VITE_SUPABASE_ANON_KEY'
   const SUPABASE_URL = 'https://qhcgqdsfriyvkpjdwseu.supabase.co'

   const TEMPLATE_NAME = '核對單範本'

   // 在編輯器執行一次：完成授權，並在資料夾建好範本
   function setup() {
     getTemplate(DriveApp.getFolderById(FOLDER_ID))
   }

   function doPost(e) {
     try {
       const { token, name, info, items } = JSON.parse(e.postData.contents)
       // 用呼叫者的登入憑證問 Supabase：最高權限回 admin、學會成員回 operator（登入過期就不是這兩個）
       const access = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/backend_access', {
         method: 'post',
         contentType: 'application/json',
         headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
         payload: '{}',
         muteHttpExceptions: true,
       })
       if (access.getResponseCode() !== 200 || !['admin', 'operator'].includes(JSON.parse(access.getContentText()))) return reply({ error: '沒有權限' })
       if (!name || !info || !Array.isArray(items) || !items.length) return reply({ error: '訂單資料不完整' })
       const folder = DriveApp.getFolderById(FOLDER_ID)
       const copy = getTemplate(folder).makeCopy(name, folder)
       fill(SpreadsheetApp.openById(copy.getId()).getSheets()[0], info, items)
       return reply({ ok: true })
     } catch (err) {
       return reply({ error: String(err) })
     }
   }

   // 品項列＝有 {{品項}} 的那一列：依品項數往下複製（格式和勾選框一起），只寫有 {{…}} 的欄
   function fill(sheet, info, items) {
     const row = sheet.createTextFinder('{{品項}}').findNext().getRow()
     const width = sheet.getLastColumn()
     const columns = sheet.getRange(row, 1, 1, width).getValues()[0]
     if (items.length > 1) {
       sheet.insertRowsAfter(row, items.length - 1)
       sheet.getRange(row, 1, 1, width).copyTo(sheet.getRange(row + 1, 1, items.length - 1, width))
     }
     columns.forEach((column, i) => {
       const key = String(column).match(/^\{\{(.+)\}\}$/)
       if (!key) return
       sheet.getRange(row, i + 1, items.length, 1).setValues(items.map(item => [asCell(item[key[1]])]))
       if (key[1] === '存放地點') mergeRuns(sheet, row, i + 1, items.map(item => item[key[1]]))
     })
     Object.keys(info).forEach(key => {
       sheet.createTextFinder('{{' + key + '}}').findAll().forEach(cell => cell.setValue(asCell(info[key])))
     })
   }

   // 相鄰同值的格子合併成一格（前端已依存放地點排序）
   function mergeRuns(sheet, row, column, values) {
     let start = 0
     values.forEach((value, i) => {
       if (values[i + 1] === value) return
       if (i > start) sheet.getRange(row + start, column, i - start + 1, 1).merge()
       start = i + 1
     })
   }

   // 字串前加 ' 存成純文字：學生填的內容不會被當公式，「1/2」也不會變日期
   function asCell(value) {
     return typeof value === 'string' && value ? "'" + value : value ?? ''
   }

   // 資料夾裡的範本；被刪掉了就照內建格式重建。學會要改格式直接改這份
   function getTemplate(folder) {
     const found = folder.getFilesByName(TEMPLATE_NAME)
     while (found.hasNext()) {
       const file = found.next()
       if (!file.isTrashed()) return file
     }
     const spreadsheet = SpreadsheetApp.create(TEMPLATE_NAME)
     const sheet = spreadsheet.getSheets()[0]
     // 版型沿用學會原本的「團體預約清單」，多了取件／歸還兩欄和單號、取件時段
     const area = a1 => a1.includes(':') ? sheet.getRange(a1).merge() : sheet.getRange(a1)
     const LABEL_BG = '#e0ebfd'
     const LINE = '#e1e1e1'
     area('A1:G1').setValue('大量設備核對單').setBackground('#3956c4').setFontColor('#ffffff').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
     const fields = [
       ['A2:B2', '活動名稱', 'C2:G2', '使用原因'],
       ['A3:B3', '預約日期', 'C3', '借用期間'],
       ['D3:E3', '取件時段', 'F3:G3', '取件時段'],
       ['A4:B4', '負責教師', 'C4', '負責老師'],
       ['D4:E4', '單號', 'F4:G4', '單號'],
       ['A5:B5', '負責人姓名', 'C5', '借用人'],
       ['D5:E5', '負責人班級', 'F5:G5', '使用班級'],
     ]
     fields.forEach(([labelCell, label, valueCell, key]) => {
       area(labelCell).setValue(label).setBackground(LABEL_BG).setFontWeight('bold')
       area(valueCell).setValue('{{' + key + '}}').setWrap(true)
     })
     sheet.getRange('A7:G7').setValues([['存放地點', '類別', '品項', '數量', '取件', '歸還', '備註']]).setBackground(LABEL_BG).setFontWeight('bold')
     sheet.getRange('A8:D8').setValues([['{{存放地點}}', '{{類別}}', '{{品項}}', '{{數量}}']])
     sheet.getRange('E8:F8').insertCheckboxes()
     sheet.getRange('A8').setHorizontalAlignment('center')
     sheet.getRange('B8').setFontWeight('bold').setHorizontalAlignment('center')
     sheet.getRange('C8').setWrap(true)
     sheet.getRange('E7:F8').setHorizontalAlignment('center')
     sheet.getRange('A2:G5').setBorder(true, true, true, true, true, true, LINE, SpreadsheetApp.BorderStyle.SOLID)
     sheet.getRange('A7:G8').setBorder(true, true, true, true, true, true, LINE, SpreadsheetApp.BorderStyle.SOLID)
     sheet.getRange('A2:G8').setVerticalAlignment('middle')
     const widths = [110, 120, 300, 50, 50, 50, 220]
     widths.forEach((width, i) => sheet.setColumnWidth(i + 1, width))
     SpreadsheetApp.flush()
     const file = DriveApp.getFileById(spreadsheet.getId())
     file.moveTo(folder)
     return file
   }

   function reply(obj) {
     return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
   }
   ```

3. 編輯器上方的函式下拉選 **setup**，按**執行**。Google 會要求授權（會出現「未經驗證的應用程式」，按**進階 → 前往**，這是自己的程式；權限**全部勾選**）。跑完資料夾會多一份 `核對單範本`。
4. 右上 **部署 → 新增部署作業** → 齒輪選 **網頁應用程式**：
   - **執行身分**：我
   - **具有存取權的使用者**：所有人
5. 按**部署**，複製**網頁應用程式網址**（`/exec` 結尾）。
6. 把網址填進 `.env` 和 Vercel 環境變數的 `VITE_DRIVE_UPLOAD_URL`，重新部署前端。
7. 到後台訂單頁，大量設備單按「核對單」，確認資料夾多了一份試算表。

## 調整範本

學會可以直接改資料夾裡的 `核對單範本`（字體、顏色、列高、欄寬都可以），不用動程式，也不用重新部署，下一次按「核對單」就生效；已經建好的核對單不會跟著變。**檔名不要改**。範本被刪掉時，會退回程式裡的預設樣式。

- `{{…}}` 會換成訂單資料，要**獨佔一格**，可以搬位置，用不到的可以刪：`{{單號}}`、`{{借用人}}`、`{{使用班級}}`、`{{負責老師}}`、`{{借用期間}}`、`{{取件時段}}`、`{{使用原因}}`。
- 有 `{{品項}}` 的那一列是品項列，會依品項數往下複製，格式和勾選框一起帶。這一列可用 `{{#}}`、`{{存放地點}}`、`{{類別}}`、`{{品項}}`、`{{數量}}`，欄位順序可以調，也可以加欄。`{{品項}}` 不能刪。
- 品項依存放地點、類別排序，相鄰同地點的 `{{存放地點}}` 會合併成一格。地點文字來自後台設備管理的「存放地點」。

## 之後要知道的

- **每按一次都是新檔**，不會覆蓋學會改過的版本。學生改單後要重新按一次，新舊版本看 Drive 的檔案時間。
- **改 Apps Script 程式**：部署 → **管理部署作業** → 鉛筆 → 版本選**新版本**。這樣網址不變；用「新增部署作業」網址會變。程式用到新權限時，要先照步驟 3 執行一次 `setup`。

## 轉給學會帳號（換帳號也一樣）

要讓新帳號自己部署一份，之後才不依賴舊帳號。新帳號要能編輯資料夾。

1. 舊帳號在 Google Drive 找到這個 Apps Script 專案，共用給新帳號。
2. 新帳號登入（同樣只登入這個帳號），從 Drive 的「與我共用」打開專案 → 左側**總覽** → 右上**建立副本**。
3. 新帳號打開資料夾裡的 `核對單範本` → **檔案 → 建立副本**，放同一個資料夾，名稱改回 `核對單範本`（這樣改過的格式會留著）。舊帳號再刪掉舊的範本和測試檔。
4. 新帳號在副本做步驟 3–5（`setup` 這時只做授權，會沿用剛複製的範本），拿到新的 `/exec` 網址，再做步驟 6–7。網址換了，`.env` 和 Vercel 都要改。
5. 確認建得出來後，把舊專案的部署封存；舊帳號不需要資料夾權限的話，也一併移除。

## 出問題時

| 後台的提示 | 原因 |
|---|---|
| 尚未設定 Google Drive | `VITE_DRIVE_UPLOAD_URL` 沒設，或設了但前端沒重新部署 |
| 連不上 Google Drive | 網址錯，或步驟 4 的存取權不是「所有人」 |
| 建立試算表失敗（沒有權限） | 登入過期，重新登入後台；或 `SUPABASE_ANON_KEY` 貼錯 |
| 建立試算表失敗（其他英文錯誤） | 多半是 `FOLDER_ID` 錯、部署帳號不能編輯該資料夾、授權沒有全勾（重跑步驟 3），或範本的 `{{品項}}` 被刪了 |
