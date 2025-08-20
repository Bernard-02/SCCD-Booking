/* ===== Scroll to Top 按鈕功能 ===== */

document.addEventListener('DOMContentLoaded', function() {
    initScrollToTop();
});

function initScrollToTop() {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    
    if (!scrollToTopBtn) return;
    
    let lastScrollTop = 0;
    let scrollTimeout;
    
    // 滾動事件監聽器
    window.addEventListener('scroll', function() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 清除之前的計時器
        clearTimeout(scrollTimeout);
        
        // 設置新的計時器，避免過於頻繁的計算
        scrollTimeout = setTimeout(() => {
            handleScroll(currentScrollTop, lastScrollTop);
            lastScrollTop = currentScrollTop;
        }, 10);
    });
    
    // 點擊事件監聽器
    scrollToTopBtn.addEventListener('click', function() {
        scrollToTop();
    });
}

function handleScroll(currentScrollTop, lastScrollTop) {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    const windowHeight = window.innerHeight;
    
    // 判斷是否需要顯示按鈕的條件：
    // 1. 滾動超過一個視窗高度，或
    // 2. 有向下滾動的動作且滾動距離超過100px
    const hasScrolledDown = currentScrollTop > lastScrollTop;
    const hasScrolledOneScreen = currentScrollTop > windowHeight;
    const hasMinimalScroll = currentScrollTop > 100;
    
    const shouldShow = (hasScrolledOneScreen || hasScrolledDown) && hasMinimalScroll;
    
    if (shouldShow) {
        showScrollToTopBtn();
    } else if (currentScrollTop <= 50) { // 接近頂部時隱藏
        hideScrollToTopBtn();
    }
}

function showScrollToTopBtn() {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    
    if (!scrollToTopBtn.classList.contains('visible')) {
        scrollToTopBtn.classList.add('visible');
        scrollToTopBtn.style.opacity = '1';
        scrollToTopBtn.style.visibility = 'visible';
    }
}

function hideScrollToTopBtn() {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    
    if (scrollToTopBtn.classList.contains('visible')) {
        scrollToTopBtn.classList.remove('visible');
        scrollToTopBtn.style.opacity = '0';
        scrollToTopBtn.style.visibility = 'hidden';
    }
}

function scrollToTop() {
    // 使用 GSAP 實現平滑滾動動畫
    if (typeof gsap !== 'undefined') {
        gsap.to(window, {
            duration: 1.2,
            scrollTo: { y: 0, autoKill: true },
            ease: "power2.out"
        });
    } else {
        // 如果沒有 GSAP，使用原生的平滑滾動
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    // 滾動完成後隱藏按鈕
    setTimeout(() => {
        hideScrollToTopBtn();
    }, 1200);
}

// 防抖函數，避免過於頻繁的滾動事件處理
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
