/* ===== 設備篩選系統 JavaScript ===== */

// 桌面版篩選器管理
class DesktopFilter {
  constructor() {
    this.categoryButtons = document.querySelectorAll('.filter-button');
    this.statusButtons = document.querySelectorAll('#status-available, #status-unavailable');
    this.equipmentCards = document.querySelectorAll('.equipment-card');
    this.currentCategory = 'all';
    this.currentStatus = '有現貨';
    this.init();
  }
  
  init() {
    if (this.categoryButtons.length === 0 || this.equipmentCards.length === 0) return;
    
    this.setupCategoryFilters();
    this.setupStatusFilters();
    
    // 初始化：默認顯示所有"有現貨"的設備
    this.filterCards();
  }
  
  setupCategoryFilters() {
    this.categoryButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const category = e.target.getAttribute('data-category');
        this.currentCategory = category;
        
        // 更新篩選器樣式
        this.categoryButtons.forEach(btn => {
          btn.classList.remove('filter-active', 'font-bold');
          btn.classList.add('font-normal');
        });
        
        // 為選中的按鈕添加樣式
        e.target.classList.add('filter-active', 'font-bold');
        e.target.classList.remove('font-normal');
        
        this.filterCards();
      });
    });
  }
  
  setupStatusFilters() {
    this.statusButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const status = e.target.getAttribute('data-status');
        this.currentStatus = status;
        
        // 更新chip樣式
        this.statusButtons.forEach(btn => {
          btn.classList.remove('bg-white', 'text-black');
          btn.classList.add('border', 'border-white', 'text-white');
        });
        e.target.classList.remove('border', 'border-white', 'text-white');
        e.target.classList.add('bg-white', 'text-black');
        
        this.filterCards();
      });
    });
  }
  
  filterCards() {
    this.equipmentCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardStatus = card.getAttribute('data-status');
      
      const categoryMatch = this.currentCategory === 'all' || cardCategory === this.currentCategory;
      const statusMatch = cardStatus === this.currentStatus;
      
      if (categoryMatch && statusMatch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
    
    // 重新分組可見卡片並添加動畫
    this.animateFilteredCards();
  }
  
  animateFilteredCards() {
    // 重置所有卡片動畫狀態
    this.equipmentCards.forEach(card => {
      card.classList.remove('animate-in');
      card.style.opacity = '';
      card.style.transform = '';
    });
    
    // 立即調用重新計算，內部已有足夠延遲
    if (window.recalculateRows) {
      window.recalculateRows();
    }
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
    this.init();
  }
  
  init() {
    if (!this.filtersBtn || !this.bottomSheet || !this.overlay || !this.applyBtn) return;
    
    this.setupEventListeners();
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
    this.equipmentCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardStatus = card.getAttribute('data-status');
      
      const categoryMatch = categories.length === 0 || categories.includes(cardCategory);
      const statusMatch = cardStatus === status;
      
      if (categoryMatch && statusMatch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
    
    // 重新觸發動畫
    if (window.recalculateRows) {
      window.recalculateRows();
    }
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