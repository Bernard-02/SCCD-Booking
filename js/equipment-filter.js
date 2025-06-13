/* ===== 設備篩選系統 JavaScript ===== */

// 桌面版篩選器管理
class DesktopFilter {
  constructor() {
    this.categoryButtons = document.querySelectorAll('.filter-button');
    this.statusButtons = document.querySelectorAll('#status-available, #status-unavailable');
    this.equipmentCards = document.querySelectorAll('.equipment-card');
    this.searchInput = document.getElementById('searchInput');
    this.currentCategory = 'all';
    this.currentStatus = '有現貨';
    this.currentSearchText = '';
    this.init();
  }
  
  init() {
    if (this.categoryButtons.length === 0 || this.equipmentCards.length === 0) return;
    
    this.setupCategoryFilters();
    this.setupStatusFilters();
    this.setupSearchFilter();
    
    // 初始化：使用進場動畫顯示默認內容
    this.startEnterAnimation();
  }
  
  setupCategoryFilters() {
    this.categoryButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const newCategory = e.target.getAttribute('data-category');
        
        // 如果點擊的是當前分類，不做任何處理
        if (this.currentCategory === newCategory) return;
        
        // 開始分類切換過程
        this.switchCategory(newCategory, e.target);
      });
    });
  }
  
  // 新增：分類切換管理方法
  switchCategory(newCategory, buttonElement) {
    // 計算適當的延遲時間 - 如果從"查看全部"切換到其他分類，需要更長時間
    const isFromAll = this.currentCategory === 'all';
    const delayTime = isFromAll ? 600 : 450; // 從查看全部切換需要更長時間
    
    // 第一階段：出場動畫
    this.startExitAnimation();
    
    // 更新按鈕狀態
    this.updateCategoryButtonStyles(buttonElement);
    
    // 等待出場動畫完成後開始進場
    setTimeout(() => {
      this.currentCategory = newCategory;
      this.startEnterAnimation();
    }, delayTime);
  }
  
  // 新增：出場動畫
  startExitAnimation() {
    // 獲取當前可見的卡片
    const visibleCards = Array.from(this.equipmentCards).filter(card => 
      window.getComputedStyle(card).display !== 'none' && 
      card.classList.contains('animate-in')
    );
    
    // 根據當前分類決定出場速度
    const isFromAll = this.currentCategory === 'all';
    const cardInterval = isFromAll ? 30 : 50; // 從查看全部切換時更快的出場
    
    // 為可見卡片添加出場動畫
    visibleCards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.remove('animate-in');
        card.classList.add('animate-out');
      }, index * cardInterval);
    });
  }
  
  // 新增：進場動畫
  startEnterAnimation() {
    // 重置所有卡片狀態
    this.equipmentCards.forEach(card => {
      card.classList.remove('animate-in', 'animate-out', 'transitioning');
      card.style.opacity = '';
      card.style.transform = '';
    });
    
    // 篩選需要顯示的卡片
    this.filterCards();
    
    // 觸發進場動畫
    this.animateFilteredCards();
  }
  
  // 更新：按鈕樣式更新方法
  updateCategoryButtonStyles(selectedButton) {
    this.categoryButtons.forEach(btn => {
      btn.classList.remove('filter-active', 'font-bold');
      btn.classList.add('font-normal');
    });
    
    selectedButton.classList.add('filter-active', 'font-bold');
    selectedButton.classList.remove('font-normal');
  }
  
  setupStatusFilters() {
    this.statusButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const newStatus = e.target.getAttribute('data-status');
        
        // 如果點擊的是當前狀態，不做任何處理
        if (this.currentStatus === newStatus) return;
        
        // 開始狀態切換
        this.switchStatus(newStatus, e.target);
      });
    });
  }
  
  // 新增：狀態切換管理方法
  switchStatus(newStatus, buttonElement) {
    // 計算適當的延遲時間
    const isFromAll = this.currentCategory === 'all';
    const delayTime = isFromAll ? 600 : 450;
    
    // 開始出場動畫
    this.startExitAnimation();
    
    // 更新按鈕狀態
    this.updateStatusButtonStyles(buttonElement);
    
    // 等待出場動畫完成後開始進場
    setTimeout(() => {
      this.currentStatus = newStatus;
      this.startEnterAnimation();
    }, delayTime);
  }
  
  // 新增：狀態按鈕樣式更新方法
  updateStatusButtonStyles(selectedButton) {
    this.statusButtons.forEach(btn => {
      btn.classList.remove('bg-white', 'text-black');
      btn.classList.add('border', 'border-white', 'text-white');
    });
    selectedButton.classList.remove('border', 'border-white', 'text-white');
    selectedButton.classList.add('bg-white', 'text-black');
  }
  
  setupSearchFilter() {
    if (!this.searchInput) return;
    
    // 實時搜尋 - 使用防抖技術
    let searchTimeout;
    this.searchInput.addEventListener('input', (e) => {
      const newSearchText = e.target.value.toLowerCase().trim();
      
      // 清除之前的定時器
      clearTimeout(searchTimeout);
      
      // 如果搜尋文字沒有變化，不處理
      if (this.currentSearchText === newSearchText) return;
      
      // 設置新的定時器
      searchTimeout = setTimeout(() => {
        this.switchSearch(newSearchText);
      }, 300); // 300ms防抖
    });
  }
  
  // 新增：搜尋切換管理方法
  switchSearch(newSearchText) {
    // 如果有可見卡片，先執行出場動畫
    const hasVisibleCards = Array.from(this.equipmentCards).some(card => 
      window.getComputedStyle(card).display !== 'none' && 
      card.classList.contains('animate-in')
    );
    
    if (hasVisibleCards) {
      // 計算適當的延遲時間
      const isFromAll = this.currentCategory === 'all';
      const delayTime = isFromAll ? 600 : 450;
      
      this.startExitAnimation();
      setTimeout(() => {
        this.currentSearchText = newSearchText;
        this.startEnterAnimation();
      }, delayTime);
    } else {
      this.currentSearchText = newSearchText;
      this.startEnterAnimation();
    }
  }
  
  filterCards() {
    // 設置卡片的顯示狀態
    this.equipmentCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardStatus = card.getAttribute('data-status');
      
      // 獲取設備名稱進行文字匹配
      const nameElement = card.querySelector('.text-lg, .text-xl');
      const equipmentName = nameElement ? nameElement.textContent.toLowerCase() : '';
      
      const categoryMatch = this.currentCategory === 'all' || cardCategory === this.currentCategory;
      const statusMatch = cardStatus === this.currentStatus;
      const searchMatch = this.currentSearchText === '' || equipmentName.includes(this.currentSearchText);
      
      if (categoryMatch && statusMatch && searchMatch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  animateFilteredCards() {
    // 確保卡片處於初始隱藏狀態
    this.equipmentCards.forEach(card => {
      if (window.getComputedStyle(card).display !== 'none') {
        card.classList.remove('animate-in', 'animate-out', 'transitioning');
        // 強制重排以確保樣式已應用
        card.offsetHeight;
      }
    });
    
    // 延遲重新計算動畫，確保 DOM 更新完成
    setTimeout(() => {
      if (window.recalculateRows) {
        window.recalculateRows();
      }
    }, 50);
  }
}

// 手機版底部篩選器管理
class MobileFilter {
  constructor() {
    this.filtersBtn = document.getElementById('mobile-filters-btn');
    this.bottomSheet = document.getElementById('filters-bottom-sheet');
    this.overlay = document.getElementById('filters-overlay');
    this.applyBtn = document.getElementById('apply-filters-btn');
    this.clearBtn = document.getElementById('clear-filters-btn');
    this.categoryButtons = document.querySelectorAll('.mobile-filter-category');
    this.equipmentCards = document.querySelectorAll('.equipment-card');
    this.mobileSearchInput = document.getElementById('mobileSearchInput');
    this.currentSearchText = '';
    this.init();
  }
  
  init() {
    if (!this.filtersBtn || !this.bottomSheet || !this.overlay || !this.applyBtn) return;
    
    this.setupEventListeners();
    this.setupMobileSearchFilter();
  }
  
  setupEventListeners() {
    // 打開篩選器
    this.filtersBtn.addEventListener('click', () => this.openBottomSheet());
    
    // 關閉篩選器
    this.overlay.addEventListener('click', () => this.closeBottomSheet());
    
    // 應用篩選
    this.applyBtn.addEventListener('click', () => {
      const selectedCategories = Array.from(this.categoryButtons)
        .filter(btn => btn.classList.contains('font-bold'))
        .map(btn => btn.getAttribute('data-category'));
      
      const selectedStatus = '有現貨'; // 手機版固定為有現貨
      
      this.applyMobileFilters(selectedCategories, selectedStatus);
      this.closeBottomSheet();
    });
    
    // 清除篩選
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.currentSearchText = '';
        if (this.mobileSearchInput) {
          this.mobileSearchInput.value = '';
        }
        this.applyMobileFilters([], '有現貨');
        this.closeBottomSheet();
      });
    }
    
    // 分類選擇
    this.categoryButtons.forEach(button => {
      button.addEventListener('click', () => {
        button.classList.toggle('font-bold');
        button.classList.toggle('font-normal');
      });
    });
  }
  
  setupMobileSearchFilter() {
    if (!this.mobileSearchInput) return;
    
    // 實時搜尋 - 每次輸入都觸發
    this.mobileSearchInput.addEventListener('input', (e) => {
      const newSearchText = e.target.value.toLowerCase().trim();
      
      // 如果是從有內容變成空白（刪除所有文字），需要特殊處理
      if (this.currentSearchText !== '' && newSearchText === '') {
        // 先隱藏所有卡片避免跳動
        this.equipmentCards.forEach(card => {
          card.style.display = 'none';
          card.classList.remove('animate-in');
          card.style.opacity = '';
          card.style.transform = '';
        });
        
        // 延遲更新搜尋文字和重新篩選
        setTimeout(() => {
          this.currentSearchText = newSearchText;
          this.filterMobileCards();
        }, 50);
      } else {
        this.currentSearchText = newSearchText;
        this.filterMobileCards();
      }
    });
    
    // 清空搜尋框時重置
    this.mobileSearchInput.addEventListener('blur', (e) => {
      if (e.target.value.trim() === '') {
        this.currentSearchText = '';
        this.filterMobileCards();
      }
    });
  }
  
  filterMobileCards() {
    // 重置所有卡片動畫狀態
    this.equipmentCards.forEach(card => {
      card.classList.remove('animate-in');
      // 移除內聯樣式，讓CSS的默認樣式生效
      card.style.opacity = '';
      card.style.transform = '';
    });
    
    this.equipmentCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardStatus = card.getAttribute('data-status');
      
      // 獲取設備名稱進行文字匹配
      const nameElement = card.querySelector('.text-lg, .text-xl');
      const equipmentName = nameElement ? nameElement.textContent.toLowerCase() : '';
      
      const statusMatch = cardStatus === '有現貨'; // 手機版固定只顯示有現貨
      const searchMatch = this.currentSearchText === '' || equipmentName.includes(this.currentSearchText);
      
      if (statusMatch && searchMatch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
    
    // 延遲重新觸發動畫
    setTimeout(() => {
      if (window.recalculateRows) {
        window.recalculateRows();
      }
    }, 50);
  }
  
  openBottomSheet() {
    this.bottomSheet.classList.add('active');
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  closeBottomSheet() {
    this.bottomSheet.classList.remove('active');
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  applyMobileFilters(categories, status) {
    // 先執行出場動畫
    this.startMobileExitAnimation();
    
    // 等待出場動畫完成後開始進場
    setTimeout(() => {
      this.equipmentCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        const cardStatus = card.getAttribute('data-status');
        
        // 獲取設備名稱進行文字匹配
        const nameElement = card.querySelector('.text-lg, .text-xl');
        const equipmentName = nameElement ? nameElement.textContent.toLowerCase() : '';
        
        const categoryMatch = categories.length === 0 || categories.includes(cardCategory);
        const statusMatch = cardStatus === status;
        const searchMatch = this.currentSearchText === '' || equipmentName.includes(this.currentSearchText);
        
        if (categoryMatch && statusMatch && searchMatch) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
      
      // 觸發進場動畫
      if (window.recalculateRows) {
        window.recalculateRows();
      }
    }, 450);
  }
  
  // 新增：手機版出場動畫
  startMobileExitAnimation() {
    const visibleCards = Array.from(this.equipmentCards).filter(card => 
      window.getComputedStyle(card).display !== 'none' && 
      card.classList.contains('animate-in')
    );
    
    visibleCards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.remove('animate-in');
        card.classList.add('animate-out');
      }, index * 50);
    });
  }
}

// 全域函數
window.DesktopFilter = DesktopFilter;
window.MobileFilter = MobileFilter;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  // 檢查是否在設備頁面
  if (document.querySelector('.equipment-card')) {
    new DesktopFilter();
    new MobileFilter();
  }
}); 