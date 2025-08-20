/* ===== UI 動畫效果 JavaScript ===== */

// 設備卡片進場動畫管理
class EquipmentCardAnimations {
  constructor() {
    this.animatedRows = new Set();
    this.equipmentCards = [];
    this.init();
  }
  
  init() {
    this.equipmentCards = document.querySelectorAll('.equipment-card');
    if (this.equipmentCards.length === 0) return;
    
    // 延遲初始化以確保頁面佈局完成
    setTimeout(() => {
      this.calculateRowNumbers();
      this.triggerAllVisibleAnimations();
    }, 100);
    
    // 全域函數供篩選器調用
    window.recalculateRows = () => {
      setTimeout(() => {
        this.calculateRowNumbers();
        this.triggerAllVisibleAnimations();
      }, 100);
    };
  }
  
  // 計算並設置每張卡片的行號
  calculateRowNumbers() {
    if (window.innerWidth < 768) return; // 只在桌面版執行
    
    const visibleCards = Array.from(this.equipmentCards).filter(card => 
      window.getComputedStyle(card).display !== 'none'
    );
    
    // 強制重排以確保位置準確
    visibleCards.forEach(card => card.offsetHeight);
    
    let currentRow = 0;
    let lastTop = -1;
    
    visibleCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardTop = Math.round(rect.top + window.scrollY);
      
      if (index > 0 && Math.abs(cardTop - lastTop) > 10) {
        currentRow++;
      }
      
      card.setAttribute('data-row', currentRow);
      lastTop = cardTop;
    });
  }
  
  // 觸發所有可見卡片的進場動畫
  triggerAllVisibleAnimations() {
    this.animatedRows.clear();
    
    // 先重置所有卡片的動畫狀態
    this.equipmentCards.forEach(card => {
      card.classList.remove('animate-in');
      // 移除內聯樣式，讓CSS的默認樣式生效
      card.style.opacity = '';
      card.style.transform = '';
    });
    
    // 獲取所有可見的行，按順序處理
    const visibleCards = Array.from(this.equipmentCards).filter(card => 
      window.getComputedStyle(card).display !== 'none'
    );
    
    // 按行號分組
    const rowGroups = {};
    visibleCards.forEach(card => {
      const row = parseInt(card.getAttribute('data-row'));
      if (!rowGroups[row]) {
        rowGroups[row] = [];
      }
      rowGroups[row].push(card);
    });
    
    // 按行號順序觸發動畫
    Object.keys(rowGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach((rowNumber, rowIndex) => {
      const rowCards = rowGroups[rowNumber];
      
      // 每一行延遲300ms，行內卡片間隔150ms
      rowCards.forEach((card, cardIndex) => {
        setTimeout(() => {
          card.classList.add('animate-in');
        }, (rowIndex * 300) + (cardIndex * 150) + 200);
      });
      
      this.animatedRows.add(parseInt(rowNumber));
    });
  }
  
  // 重置動畫狀態
  resetAnimations() {
    this.equipmentCards.forEach(card => {
      card.classList.remove('animate-in');
      card.style.opacity = '';
      card.style.transform = '';
    });
  }
}

// Toast 提示功能
class ToastManager {
  static show(message) {
    // 檢查是否已有toast，如果有則移除
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 創建新的toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // 創建內部的p元素
    const p = document.createElement('p');
    p.textContent = message;
    toast.appendChild(p);
    
    // 添加到頁面
    document.body.appendChild(toast);
    
    // 自動移除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }
}

// 進場動畫通用函數 - 修復版本，不干擾CSS動畫
function initPageAnimations() {
  // 對於首頁，動畫由CSS控制，JavaScript不需要干預
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    return; // 首頁的動畫完全由CSS處理
  }
  
  // 對於其他頁面，初始化各種動畫元素
  const animateEnterElements = document.querySelectorAll('.animate-enter-content');
  
  animateEnterElements.forEach((element, index) => {
    // 為不同元素設置不同的延遲
    const delay = index * 200 + 500; // 基礎延遲500ms，每個元素間隔200ms
    
    setTimeout(() => {
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
    }, delay);
  });
}

// 搜尋框動畫
function initSearchAnimation() {
  const searchInput = document.getElementById('search-input');
  const searchLabel = document.querySelector('.search-label');
  const searchCursor = document.querySelector('.search-cursor');
  
  if (!searchInput || !searchLabel || !searchCursor) return;
  
  function showCursor() {
    searchCursor.style.opacity = '1';
  }
  
  function hideCursor() {
    searchCursor.style.opacity = '0';
  }
  
  function toggleLabel() {
    if (searchInput.value.trim() !== '') {
      searchLabel.style.opacity = '0';
    } else {
      searchLabel.style.opacity = '1';
    }
  }
  
  // 事件監聽器
  searchInput.addEventListener('mouseenter', showCursor);
  searchInput.addEventListener('blur', hideCursor);
  searchInput.addEventListener('mouseleave', function() {
    if (document.activeElement !== searchInput) {
      hideCursor();
    }
  });
  searchInput.addEventListener('input', toggleLabel);
}

// 全域變數和函數
window.EquipmentCardAnimations = EquipmentCardAnimations;
window.ToastManager = ToastManager;
window.showToast = ToastManager.show;
window.initPageAnimations = initPageAnimations;
window.initSearchAnimation = initSearchAnimation;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  // 初始化設備卡片動畫
  if (document.querySelector('.equipment-card')) {
    new EquipmentCardAnimations();
  }
  
  // 初始化頁面進場動畫
  initPageAnimations();
  
  // 初始化搜尋框動畫
  initSearchAnimation();
}); 