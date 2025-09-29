// About 頁面交互邏輯

class AboutPageManager {
    constructor() {
        this.container = document.querySelector('.container');
        this.dynamicTitle = document.getElementById('dynamic-title');
        this.titleText = document.getElementById('title-text');
        this.scrollArea = document.getElementById('scroll-area');
        this.stage1 = document.getElementById('stage-1');
        this.stage2 = document.getElementById('stage-2');
        this.stage3 = document.getElementById('stage-3');

        // 標題循環數組
        this.titles = [
            { text: 'ABOUT', class: 'font-english' },
            { text: '誰做的系統', class: 'font-chinese' },
            { text: 'SCCD BOOKING', class: 'font-english' }
        ];
        this.currentTitleIndex = 0;
        this.titleInterval = null;
        this.titleAtTop = false;

        // 多階段滾動系統
        this.scrollPosition = 0;
        this.totalStages = 4; // 總共4個滾動階段（增加緩衝階段）
        this.stageWidth = window.innerWidth; // 每個階段的寬度
        this.maxScroll = this.stageWidth * this.totalStages; // 總滾動距離
        this.scrollSpeed = 1.2; // 滾動速度係數

        this.init();
    }

    init() {
        // 1 秒後自動觸發動畫
        setTimeout(() => {
            this.moveToTop();
        }, 1000);

        // 設置名字hover效果
        this.setupNameHoverEffects();
    }

    bindWheelEvents() {
        // 監聽滾動區域的 wheel 事件
        if (this.scrollArea) {
            this.scrollArea.addEventListener('wheel', (e) => {
                e.preventDefault(); // 阻止默認垂直滾動

                // 將垂直滾動轉換為水平移動
                this.scrollPosition += e.deltaY * this.scrollSpeed;

                // 限制滾動範圍
                this.scrollPosition = Math.max(0, Math.min(this.maxScroll, this.scrollPosition));

                // 更新所有階段的位置
                this.updateStagesPosition();
            });
        }
    }

    updateStagesPosition() {
        // 計算當前處於哪個階段
        const currentStage = Math.floor(this.scrollPosition / this.stageWidth);
        const stageProgress = (this.scrollPosition % this.stageWidth) / this.stageWidth;

        // 更新第一階段
        this.updateStage1Position(stageProgress, currentStage);

        // 更新第二階段
        this.updateStage2Position(stageProgress, currentStage);

        // 更新第三階段
        this.updateStage3Position(stageProgress, currentStage);
    }

    updateStage1Position(stageProgress, currentStage) {
        if (currentStage === 0) {
            // 第一階段：從右邊滑入
            const translateX = 100 - (stageProgress * 100);
            this.stage1.style.transform = `translateX(${translateX}%)`;
        } else if (currentStage === 1 || currentStage === 2) {
            // 第一階段已完成，保持在左邊位置（緩衝階段）
            this.stage1.style.transform = `translateX(0%)`;
        } else if (currentStage === 3) {
            // 第四階段：向左移動離開
            const translateX = -(stageProgress * 100);
            this.stage1.style.transform = `translateX(${translateX}%)`;
        } else if (currentStage >= 4) {
            // 第一階段完全離開
            this.stage1.style.transform = `translateX(-100%)`;
        }
    }

    updateStage2Position(stageProgress, currentStage) {
        if (currentStage === 1) {
            // 第二階段：從右邊滑入
            const translateX = 100 - (stageProgress * 100);
            this.stage2.style.transform = `translateX(${translateX}%)`;
        } else if (currentStage < 1) {
            // 第二階段還未開始，保持在右邊隱藏
            this.stage2.style.transform = `translateX(100%)`;
        } else if (currentStage === 2) {
            // 第二階段已完成，保持在左邊位置（緩衝階段）
            this.stage2.style.transform = `translateX(0%)`;
        } else if (currentStage === 3) {
            // 第四階段：向左移動離開
            const translateX = -(stageProgress * 100);
            this.stage2.style.transform = `translateX(${translateX}%)`;
        } else if (currentStage >= 4) {
            // 第二階段完全離開
            this.stage2.style.transform = `translateX(-100%)`;
        }
    }

    updateStage3Position(stageProgress, currentStage) {
        if (currentStage === 3) {
            // 第三階段：從右邊滑入
            const translateX = 100 - (stageProgress * 100);
            this.stage3.style.transform = `translateX(${translateX}%)`;
        } else if (currentStage < 3) {
            // 第三階段還未開始，保持在右邊隱藏
            this.stage3.style.transform = `translateX(100%)`;
        } else if (currentStage >= 4) {
            // 第三階段已完成，保持在位置
            this.stage3.style.transform = `translateX(0%)`;
        }
    }

    moveToTop() {
        // 移動標題到頂端，保持水平居中
        this.dynamicTitle.style.transform = 'translate(0%, -50%) translateY(-35vh)';
        this.titleAtTop = true;

        // 1 秒後（動畫完成後）開始標題循環和啟用滾動
        setTimeout(() => {
            this.startTitleCycle();
            this.bindWheelEvents(); // 標題到頂端後才啟用滾動
        }, 1000);
    }

    startTitleCycle() {
        this.titleInterval = setInterval(() => {
            this.currentTitleIndex = (this.currentTitleIndex + 1) % this.titles.length;
            this.setTitle(this.currentTitleIndex);
        }, 300); // 每 0.3 秒更換
    }

    setupNameHoverEffects() {
        const nameLiu = document.getElementById('name-liu');
        const nameWu = document.getElementById('name-wu');

        if (nameLiu) {
            nameLiu.addEventListener('mouseenter', () => {
                // 確保其他名字框回到原始狀態
                if (nameWu) nameWu.textContent = '吳霽';
                nameLiu.textContent = '劉冠成 ⟶ Instagram ';
            });

            nameLiu.addEventListener('mouseleave', () => {
                nameLiu.textContent = '劉冠成';
            });

            nameLiu.addEventListener('click', () => {
                window.open('https://www.instagram.com/bernard_liewwwww/', '_blank');
            });
        }

        if (nameWu) {
            nameWu.addEventListener('mouseenter', () => {
                // 確保其他名字框回到原始狀態
                if (nameLiu) nameLiu.textContent = '劉冠成';
                nameWu.textContent = '吳霽 ⟶ Instagram';
            });

            nameWu.addEventListener('mouseleave', () => {
                nameWu.textContent = '吳霽';
            });

            nameWu.addEventListener('click', () => {
                window.open('https://www.instagram.com/sky_mistyrain/', '_blank');
            });
        }
    }

    setTitle(index) {
        const title = this.titles[index];
        if (this.titleText) {
            // 直接更新文字和字體類別，無淡入淡出效果
            this.titleText.textContent = title.text;
            this.titleText.className = `${title.class} text-white text-hero-title`;
        }
    }
}

// 當頁面載入完成時初始化
document.addEventListener('DOMContentLoaded', () => {
    new AboutPageManager();
});