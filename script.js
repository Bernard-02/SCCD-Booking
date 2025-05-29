document.addEventListener('DOMContentLoaded', function () {
    // 確認我們在 booking.html 頁面並且相關元素存在
    const datePickerContainer = document.getElementById('date-picker-container');
    const displayStartDate = document.getElementById('display-start-date');
    const displayEndDate = document.getElementById('display-end-date');

    if (datePickerContainer && displayStartDate && displayEndDate) {
        flatpickr(datePickerContainer, {
            mode: "range",        // 啟用範圍選擇
            dateFormat: "Y/m/d",  // 日期在JS中處理的格式
            inline: true,         // 將日曆直接顯示在頁面上
            showMonths: 2,        // 同時顯示兩個月份 (符合你的設計稿)
            minDate: "today",     // 最早可選日期為今天
            locale: { // 修改 locale 設定
                ...flatpickr.l10ns.zh_tw, // 載入預設的繁體中文語系
                weekdays: {
                    shorthand: ["日", "一", "二", "三", "四", "五", "六"], // 只顯示 "日" 到 "六"
                    longhand: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] // 長格式可以保留或也修改
                },
                // 你也可以在這裡覆蓋月份的顯示，但通常月份名稱是正確的
                // months: {
                //     shorthand: ["一月", "二月", ...],
                //     longhand: ["一月", "二月", ...]
                // }
            },
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length === 2) {
                    // selectedDates 是一個包含 Date 物件的陣列
                    const startDate = selectedDates[0];
                    const endDate = selectedDates[1];

                    // 格式化日期以顯示 (與 dateFormat 一致)
                    // Flatpickr.formatDate 是 Flatpickr 提供的日期格式化函數
                    displayStartDate.textContent = instance.formatDate(startDate, "Y/m/d");
                    displayEndDate.textContent = instance.formatDate(endDate, "Y/m/d");
                } else if (selectedDates.length === 1) {
                    // 如果只選擇了一個日期 (正在選擇範圍中)
                    displayStartDate.textContent = instance.formatDate(selectedDates[0], "Y/m/d");
                    displayEndDate.textContent = "---- / -- / --";
                } else {
                    // 如果清除了選擇
                    displayStartDate.textContent = "---- / -- / --";
                    displayEndDate.textContent = "---- / -- / --";
                }
            },
            // 你可以在這裡添加更多 Flatpickr 的選項和事件處理
            // 例如：onDayCreate 用於自訂每天的渲染，可以用來標記不可用日期等
            // onDayCreate: function(dObj, dStr, fp, dayElem){
            //     // 檢查日期是否可租借，然後添加 class
            //     // if (dateIsNotAvailable(dObj)) {
            //     //     dayElem.classList.add("unavailable-date");
            //     // }
            // }
        });

        // 你可能需要一些額外的 CSS 來讓 Flatpickr 的 inline 模式在 bg-neutral-800 上顯示良好
        // 例如，Flatpickr 的預設 inline 日曆背景可能是白色的
        // 你可以檢查元素並覆蓋 .flatpickr-calendar.inline 的樣式
    }

    // 如果你的 script.js 也用於其他頁面，確保其他頁面的代碼不會因為找不到元素而出錯
    // 例如，處理 LOGIN 按鈕的邏輯等等...
});