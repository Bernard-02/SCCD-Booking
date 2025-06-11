/* ===== 通用 JavaScript 功能 ===== */

// 收藏夾功能（全站統一）
function initBookmarkSystem() {
  // 使用事件委派處理收藏夾按鈕點擊
  document.body.addEventListener('click', function(e) {
    const bookmarkBtn = e.target.closest('.bookmark-btn');
    if (bookmarkBtn) {
      e.preventDefault();
      e.stopPropagation();

      const equipmentName = bookmarkBtn.getAttribute('data-equipment');
      const isBookmarked = bookmarkBtn.src.includes('Fill');

      if (isBookmarked) {
        bookmarkBtn.src = 'Icons/Bookmark Sharp Regular.svg';
        if (window.showToast) {
          window.showToast(`${equipmentName}已從收藏夾中移除！`);
        }
      } else {
        bookmarkBtn.src = 'Icons/Bookmark Sharp Fill.svg';
        if (window.showToast) {
          window.showToast(`${equipmentName}已加入收藏夾！`);
        }
      }
    }
  });
}

// 通用頁面初始化
function initCommonFeatures() {
  initBookmarkSystem();
}

// 全域函數
window.initBookmarkSystem = initBookmarkSystem;
window.initCommonFeatures = initCommonFeatures;

// 自動初始化
document.addEventListener('DOMContentLoaded', initCommonFeatures); 