// 首頁儀表板功能
class HomeDashboard {
    constructor() {
        this.equipmentData = null;
        this.init();
    }

    async init() {
        try {
            await this.loadEquipmentData();
            this.updateEquipmentGrid();
        } catch (error) {
            console.error('初始化首頁儀表板失敗:', error);
        }
    }

    // 載入設備數據
    async loadEquipmentData() {
        try {
            const response = await fetch('equipment-data.json');
            if (!response.ok) throw new Error('載入設備數據失敗');
            this.equipmentData = await response.json();
        } catch (error) {
            console.error('載入設備數據錯誤:', error);
            // 使用模擬數據作為備用
            this.equipmentData = {};
        }
    }

    // 更新設備網格顯示
    updateEquipmentGrid() {
        // 設備庫存數據（示例數據）
        const equipmentData = {
            '線材': { current: 8, total: 10 },
            '工具': { current: 2, total: 7 },
            '延長線': { current: 5, total: 5 },
            '視聽類': { current: 4, total: 4 },
            '燈具': { current: 6, total: 9 },
            '展桌/畫板': { current: 1, total: 5 },
            '機具': { current: 1, total: 1 },
            '搖頭燈': { current: 0, total: 3 }
        };
        
        // 更新進度條和文字顏色
        Object.keys(equipmentData).forEach(category => {
            const data = equipmentData[category];
            const progressBar = document.getElementById(`category-${category}-progress`);
            const labelElement = document.getElementById(`category-${category}-label`);
            const currentElement = document.getElementById(`category-${category}-current`);
            const slashElement = document.getElementById(`category-${category}-slash`);
            const totalElement = document.getElementById(`category-${category}-total`);
            
            if (progressBar) {
                const percentage = data.total > 0 ? (data.current / data.total) * 100 : 0;
                progressBar.style.width = percentage + '%';
                
                // 根據庫存狀態設置進度條和文字顏色
                if (percentage < 30 || data.current === 0) {
                    // 紅色狀態 - 庫存不足或空
                    progressBar.classList.add('low-stock');
                    if (labelElement) labelElement.style.color = '#ff448a';
                    if (currentElement) currentElement.style.color = '#ff448a';
                    if (slashElement) slashElement.style.color = '#ff448a';
                    // 總數保持灰色
                    if (totalElement) totalElement.style.color = '#cccccc';
                } else {
                    // 綠色狀態 - 庫存充足
                    progressBar.classList.remove('low-stock');
                    if (labelElement) labelElement.style.color = '#00ff80';
                    if (currentElement) currentElement.style.color = '#00ff80';
                    if (slashElement) slashElement.style.color = '#00ff80';
                    // 總數保持灰色
                    if (totalElement) totalElement.style.color = '#cccccc';
                }
            }
        });
    }

    // 更新設備庫存狀態（供外部調用）
    updateEquipmentStock(equipmentId, newQuantity) {
        if (this.equipmentData && this.equipmentData[equipmentId]) {
            this.equipmentData[equipmentId].availableQuantity = newQuantity;
            this.updateEquipmentGrid();
        }
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    window.homeDashboard = new HomeDashboard();
});

// 監聽庫存變化事件
document.addEventListener('stockUpdated', (event) => {
    if (window.homeDashboard) {
        const { equipmentId, newQuantity } = event.detail;
        window.homeDashboard.updateEquipmentStock(equipmentId, newQuantity);
    }
});