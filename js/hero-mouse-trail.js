/**
 * Hero section 滑鼠軌跡圖片效果
 * 僅在桌面版啟用，手機版不適用
 */

class HeroMouseTrail {
    constructor() {
        this.trailArea = null;
        this.images = [
            'Images/A503.webp',
            'Images/A507.webp',
            'Images/A508.webp',
            'Images/A5F Numbered Area.webp',
            'Images/Classroom.webp',
            'Images/Extension Cord.webp',
            'Images/Space Image.webp'
        ];
        this.currentImageIndex = 0; // 當前圖片索引
        this.lastMousePos = { x: 0, y: 0 };
        this.lastMoveTime = 0;
        this.throttleDelay = 100; // 降低到100ms，進一步提高敏感度
        this.minMoveDistance = 20; // 降低最小移動距離，讓圖片更頻繁出現
        this.isDesktop = window.innerWidth >= 768; // md斷點
        
        this.init();
    }

    init() {
        // 只在桌面版初始化
        if (!this.isDesktop) return;
        
        this.trailArea = document.getElementById('mouseTrailArea');
        if (!this.trailArea) return;

        this.bindEvents();
    }

    bindEvents() {
        // 滑鼠移動事件，使用節流
        this.trailArea.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - this.lastMoveTime < this.throttleDelay) return;
            
            this.handleMouseMove(e);
            this.lastMoveTime = now;
        });

        // 視窗大小改變時重新檢查是否為桌面版
        window.addEventListener('resize', () => {
            this.isDesktop = window.innerWidth >= 768;
        });
    }

    handleMouseMove(e) {
        const rect = this.trailArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 計算移動距離
        const deltaX = x - this.lastMousePos.x;
        const deltaY = y - this.lastMousePos.y;
        const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 計算四周邊界靈敏度調整
        const areaWidth = rect.width;
        const areaHeight = rect.height;
        const distanceFromLeft = x;
        const distanceFromRight = areaWidth - x;
        const distanceFromTop = y;
        const distanceFromBottom = areaHeight - y;
        
        // 邊界區域為20%寬度/高度
        const horizontalThreshold = areaWidth * 0.2;
        const verticalThreshold = areaHeight * 0.2;
        
        // 計算四個方向的靈敏度係數
        let horizontalFactor = 1;
        let verticalFactor = 1;
        
        // 左右邊界檢查
        if (distanceFromLeft < horizontalThreshold) {
            horizontalFactor = distanceFromLeft / horizontalThreshold;
        } else if (distanceFromRight < horizontalThreshold) {
            horizontalFactor = distanceFromRight / horizontalThreshold;
        }
        
        // 上下邊界檢查
        if (distanceFromTop < verticalThreshold) {
            verticalFactor = distanceFromTop / verticalThreshold;
        } else if (distanceFromBottom < verticalThreshold) {
            verticalFactor = distanceFromBottom / verticalThreshold;
        }
        
        // 取較小的係數作為最終靈敏度（越靠近任何邊界都會降低靈敏度）
        const sensitivityFactor = Math.min(horizontalFactor, verticalFactor);
        
        // 調整最小移動距離，邊界區域需要更大的移動距離才會觸發
        const adjustedMinDistance = this.minMoveDistance / Math.max(sensitivityFactor, 0.15); // 最低保持15%靈敏度
        
        // 只有當移動距離超過調整後的最小距離時才創建圖片
        if (moveDistance >= adjustedMinDistance) {
            this.createTrailImage(x, y, deltaX, deltaY);
            
            // 更新滑鼠位置
            this.lastMousePos = { x, y };
        }
    }

    createTrailImage(x, y, deltaX, deltaY) {
        // 按順序選擇圖片
        const currentImage = this.images[this.currentImageIndex];
        this.currentImageIndex = (this.currentImageIndex + 1) % this.images.length;
        
        // 創建圖片元素
        const img = document.createElement('img');
        img.src = currentImage;
        img.className = 'trail-image';
        
        // 設定隨機傾斜角度，完全隨機不受滑鼠方向影響
        const offsetX = 0;
        // 隨機選擇正負方向，然後在 5-10 度範圍內
        const isPositive = Math.random() > 0.5;
        const rotation = isPositive 
            ? 5 + Math.random() * 5  // +5° 到 +10°
            : -(5 + Math.random() * 5); // -5° 到 -10°
        
        // 設置位置和樣式（圖片出現在滑鼠坐標位置）
        const yOffset = 30; // y軸偏移量
        img.style.left = `${x + offsetX}px`;
        img.style.top = `${y + yOffset}px`; // 滑鼠坐標+y軸
        img.style.setProperty('--rotation-angle', `${rotation}deg`); // 設定CSS變數
        img.style.opacity = '1'; // 直接可見，不使用淡入效果
        
        // 添加到容器
        this.trailArea.appendChild(img);
        
        // 觸發ease動畫
        requestAnimationFrame(() => {
            img.classList.add('appearing');
        });
        
        // 1秒後直接移除元素
        setTimeout(() => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        }, 1000); // 1秒維持時間
    }

    // 清理所有軌跡圖片
    clearTrails() {
        if (!this.trailArea) return;
        
        const images = this.trailArea.querySelectorAll('.trail-image');
        images.forEach(img => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        });
    }
}

// 當DOM載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    // 只在index.html頁面且為桌面版時啟用
    const isHomePage = window.location.pathname.includes('index.html') || 
                       document.querySelector('.hero-section');
    
    if (isHomePage && window.innerWidth >= 768) {
        new HeroMouseTrail();
    }
});