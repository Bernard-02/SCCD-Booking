// 在頁面載入時顯示已選擇的日期
document.addEventListener('DOMContentLoaded', function() {
    // 從 localStorage 獲取暫存的日期
    const cachedDates = localStorage.getItem('tempSelectedDates');
    if (cachedDates) {
        const dates = JSON.parse(cachedDates);
        
        // 格式化日期顯示
        const formatDate = (dateString) => {
            if (!dateString) return "----/--/--";
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        };

        // 更新起租日和歸還日的顯示
        const startDateElement = document.getElementById('display-start-date');
        const endDateElement = document.getElementById('display-end-date');
        
        if (startDateElement) {
            startDateElement.textContent = formatDate(dates.startDate);
        }
        if (endDateElement) {
            endDateElement.textContent = formatDate(dates.endDate);
        }
    }
});
