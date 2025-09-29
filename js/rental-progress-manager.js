/* ===== 租借流程管理器 ===== */
// 管理整個租借流程的狀態和時間追蹤

class RentalProgressManager {
    constructor() {
        this.storageKey = 'rentalProgress';
        this.init();
    }

    // 初始化
    init() {
        // 檢查並清理過期的租借流程
        this.checkAndClearExpiredProgress();
    }

    // 獲取當前租借流程狀態
    getProgress() {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
            try {
                return JSON.parse(data);
            } catch (error) {
                console.error('無法解析租借流程狀態:', error);
                this.clearProgress();
                return null;
            }
        }
        return null;
    }

    // 設置租借流程狀態
    setProgress(progress) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(progress));
        } catch (error) {
            console.error('無法保存租借流程狀態:', error);
        }
    }

    // 開始日期選擇階段（每次都重新計時）
    startDateSelection() {
        // 每次呼叫都重新開始計時，無論之前的狀態如何
        const progress = {
            dateSelected: false,
            dateSelectionTime: Date.now(), // 重新設置開始時間
            equipmentSelected: false,
            bookingConfirmed: false
        };
        this.setProgress(progress);
        console.log('開始24小時日期選擇倒計時');
        return progress;
    }

    // 完成日期選擇階段
    completeDateSelection() {
        const progress = this.getProgress();
        if (progress) {
            progress.dateSelected = true;
            progress.dateConfirmTime = Date.now();
            this.setProgress(progress);
        }
        return progress;
    }

    // 完成設備選擇階段
    completeEquipmentSelection() {
        const progress = this.getProgress();
        if (progress) {
            progress.equipmentSelected = true;
            progress.equipmentSelectionTime = Date.now();
            this.setProgress(progress);
        }
        return progress;
    }

    // 完成預訂確認階段
    completeBookingConfirmation() {
        const progress = this.getProgress();
        if (progress) {
            progress.bookingConfirmed = true;
            progress.bookingConfirmedTime = Date.now();
            this.setProgress(progress);
        }
        return progress;
    }

    // 檢查流程是否已完成
    isBookingComplete() {
        const progress = this.getProgress();
        return progress && progress.bookingConfirmed;
    }

    // 檢查流程是否過期（24小時）
    isProgressExpired() {
        const progress = this.getProgress();
        if (!progress) return false;

        // 如果已經完成預訂，永不過期
        if (progress.bookingConfirmed) return false;

        const now = Date.now();
        const startTime = progress.dateSelectionTime;

        if (!startTime) return false;

        const hoursDiff = (now - startTime) / (1000 * 60 * 60);
        return hoursDiff >= 24;
    }

    // 檢查並清理過期的租借流程
    checkAndClearExpiredProgress() {
        if (this.isProgressExpired()) {
            console.log('租借流程已過期，清理相關數據');
            this.clearAllRelatedData();
        }
    }

    // 清空租借流程狀態
    clearProgress() {
        localStorage.removeItem(this.storageKey);
    }

    // 清空所有相關數據
    clearAllRelatedData() {
        // 清空流程狀態
        this.clearProgress();

        // 清空日期相關數據
        localStorage.removeItem('tempSelectedDates');
        localStorage.removeItem('dateSelectionTime');
        localStorage.removeItem('selectedRentalDates');

        console.log('已清理所有過期的租借相關數據');
    }

    // 獲取流程進度百分比
    getProgressPercentage() {
        const progress = this.getProgress();
        if (!progress) return 0;

        let completedSteps = 0;
        const totalSteps = 3; // 日期選擇、設備選擇、預訂確認

        if (progress.dateSelected) completedSteps++;
        if (progress.equipmentSelected) completedSteps++;
        if (progress.bookingConfirmed) completedSteps++;

        return (completedSteps / totalSteps) * 100;
    }

    // 獲取剩餘時間（小時）
    getRemainingHours() {
        const progress = this.getProgress();
        if (!progress || !progress.dateSelectionTime) return 24;

        // 如果已經完成預訂，沒有時間限制
        if (progress.bookingConfirmed) return null;

        const now = Date.now();
        const startTime = progress.dateSelectionTime;
        const hoursPassed = (now - startTime) / (1000 * 60 * 60);
        const remainingHours = Math.max(0, 24 - hoursPassed);

        return Math.round(remainingHours * 10) / 10; // 四捨五入到小數點一位
    }
}

// 創建全域實例
window.rentalProgressManager = new RentalProgressManager();

// 暴露給其他腳本使用
window.RentalProgressManager = RentalProgressManager;