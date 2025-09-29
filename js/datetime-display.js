// 日期時間顯示功能
function updateDateTime() {
    // 獲取台北時間 (GMT+8)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const taipeiTime = new Date(utc + (8 * 3600000));
    
    // 格式化日期時間
    const year = taipeiTime.getFullYear();
    const month = taipeiTime.getMonth() + 1;
    const date = taipeiTime.getDate();
    
    let hours = taipeiTime.getHours();
    const minutes = taipeiTime.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // 轉換為12小時制
    if (hours > 12) {
        hours = hours - 12;
    } else if (hours === 0) {
        hours = 12;
    }
    
    const formattedDateTime = `${year}年${month}月${date}日 ${hours}:${minutes}${ampm}`;
    
    // 更新設備租借狀態區塊的日期時間
    const equipmentDatetime = document.getElementById('equipment-datetime');
    if (equipmentDatetime) {
        equipmentDatetime.textContent = formattedDateTime;
    }
    
    // 更新空間租借狀態區塊的日期時間
    const spaceDatetime = document.getElementById('space-datetime');
    if (spaceDatetime) {
        spaceDatetime.textContent = formattedDateTime;
    }
}

// 全域日期顯示功能 - 用於各頁面顯示選擇的租借日期
function loadAndDisplayDates() {
    const startDateElement = document.getElementById('display-start-date');
    const endDateElement = document.getElementById('display-end-date');
    
    if (!startDateElement || !endDateElement) return;
    
    // 嘗試從localStorage載入日期
    const startDate = localStorage.getItem('selectedStartDate');
    const endDate = localStorage.getItem('selectedEndDate');
    
    if (startDate && endDate) {
        // 格式化日期顯示 (YYYY/MM/DD)
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        };
        
        startDateElement.textContent = formatDate(startDate);
        endDateElement.textContent = formatDate(endDate);
        
        console.log(`顯示租借日期: ${formatDate(startDate)} - ${formatDate(endDate)}`);
    } else {
        console.log('未找到儲存的日期，顯示預設格式');
        startDateElement.textContent = '----/--/--';
        endDateElement.textContent = '----/--/--';
    }
}

// 頁面載入時立即顯示時間
document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    
    // 每分鐘更新一次時間
    setInterval(updateDateTime, 60000);
    
    // 載入並顯示租借日期（如果頁面有相關元素）
    loadAndDisplayDates();
});