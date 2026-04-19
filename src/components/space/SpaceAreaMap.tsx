/**
 * 空間地圖組件
 * 載入 A5F 平面圖 SVG 並支援區域縮放與區塊選擇
 */

import React, { useEffect, useRef, useState } from 'react'

// --- CONSTANTS ---

// 模擬後端數據結構
export const mockAreaBlocksData: Record<string, { area: string; status: 'available' | 'booked'; user: string | null }> = {
    // 中庭 Square
    'A1': { area: 'square', status: 'available', user: null },
    'A2': { area: 'square', status: 'booked', user: 'A111144001' },
    'A3': { area: 'square', status: 'available', user: null },
    'A4': { area: 'square', status: 'available', user: null },
    'A5': { area: 'square', status: 'available', user: null },
    'A6': { area: 'square', status: 'available', user: null },
    'A7': { area: 'square', status: 'booked', user: 'A111155002' },
    'A8': { area: 'square', status: 'available', user: null },
    'A9': { area: 'square', status: 'available', user: null },
    'A10': { area: 'square', status: 'available', user: null },
    'A11': { area: 'square', status: 'available', user: null },
    'B1': { area: 'square', status: 'available', user: null },
    'B2': { area: 'square', status: 'available', user: null },
    'B3': { area: 'square', status: 'available', user: null },
    'B4': { area: 'square', status: 'available', user: null },
    'B5': { area: 'square', status: 'available', user: null },
    'B6': { area: 'square', status: 'available', user: null },
    'B7': { area: 'square', status: 'available', user: null },
    'B8': { area: 'square', status: 'available', user: null },
    'B9': { area: 'square', status: 'available', user: null },
    'B10': { area: 'square', status: 'available', user: null },
    'B11': { area: 'square', status: 'available', user: null },
    'C3': { area: 'square', status: 'available', user: null },
    'C4': { area: 'square', status: 'available', user: null },
    'C5': { area: 'square', status: 'available', user: null },
    'C6': { area: 'square', status: 'available', user: null },
    'C7': { area: 'square', status: 'available', user: null },
    'C8': { area: 'square', status: 'available', user: null },
    'C9': { area: 'square', status: 'available', user: null },
    'C10': { area: 'square', status: 'available', user: null },
    'C11': { area: 'square', status: 'available', user: null },
    'D3': { area: 'square', status: 'available', user: null },
    'D4': { area: 'square', status: 'available', user: null },
    'D5': { area: 'square', status: 'available', user: null },
    'D6': { area: 'square', status: 'available', user: null },
    'D7': { area: 'square', status: 'available', user: null },
    'D8': { area: 'square', status: 'available', user: null },
    'D9': { area: 'square', status: 'available', user: null },
    'D10': { area: 'square', status: 'available', user: null },
    'D11': { area: 'square', status: 'available', user: null },
    'E1': { area: 'square', status: 'available', user: null },
    'E2': { area: 'square', status: 'available', user: null },
    'E3': { area: 'square', status: 'available', user: null },
    'E4': { area: 'square', status: 'available', user: null },
    'E5': { area: 'square', status: 'available', user: null },
    'E6': { area: 'square', status: 'available', user: null },
    'E7': { area: 'square', status: 'available', user: null },
    'E8': { area: 'square', status: 'available', user: null },
    'E9': { area: 'square', status: 'available', user: null },
    'E10': { area: 'square', status: 'available', user: null },
    'E11': { area: 'square', status: 'available', user: null },

    // 走廊 Corridor
    'H1': { area: 'corridor', status: 'available', user: null },
    'H2': { area: 'corridor', status: 'available', user: null },
    'H3': { area: 'corridor', status: 'available', user: null },
    'H4': { area: 'corridor', status: 'available', user: null },
    'H5': { area: 'corridor', status: 'available', user: null },
    'H6': { area: 'corridor', status: 'available', user: null },
    'H7': { area: 'corridor', status: 'available', user: null },
    'H8': { area: 'corridor', status: 'available', user: null },
    'H9': { area: 'corridor', status: 'available', user: null },
    'H10': { area: 'corridor', status: 'available', user: null },
    'G5': { area: 'corridor', status: 'available', user: null },
    'G6': { area: 'corridor', status: 'available', user: null },
    'G7': { area: 'corridor', status: 'available', user: null },
    'G8': { area: 'corridor', status: 'available', user: null },
    'G9': { area: 'corridor', status: 'available', user: null },
    'G10': { area: 'corridor', status: 'available', user: null },
    'J1': { area: 'corridor', status: 'available', user: null },
    'J2': { area: 'corridor', status: 'available', user: null },
    'J3': { area: 'corridor', status: 'available', user: null },

    // 前陽台 Front Terrace
    'K1': { area: 'front-terrace', status: 'available', user: null },
    'K2': { area: 'front-terrace', status: 'available', user: null },
    'K3': { area: 'front-terrace', status: 'available', user: null },
    'K4': { area: 'front-terrace', status: 'available', user: null },
    'K5': { area: 'front-terrace', status: 'available', user: null },
    'K6': { area: 'front-terrace', status: 'available', user: null },
    'K7': { area: 'front-terrace', status: 'available', user: null },
    'K8': { area: 'front-terrace', status: 'available', user: null },
    'K9': { area: 'front-terrace', status: 'available', user: null },
    'K10': { area: 'front-terrace', status: 'available', user: null },

    // 後陽台 Back Terrace
    'L1': { area: 'back-terrace', status: 'available', user: null },
    'L2': { area: 'back-terrace', status: 'available', user: null },
    'L3': { area: 'back-terrace', status: 'available', user: null },
    'L4': { area: 'back-terrace', status: 'available', user: null },
    'L5': { area: 'back-terrace', status: 'available', user: null },
    'L6': { area: 'back-terrace', status: 'available', user: null },

    // 玻璃牆 Glass Wall
    'Y1': { area: 'glass-wall', status: 'available', user: null },
    'Y2': { area: 'glass-wall', status: 'available', user: null },
    'Y3': { area: 'glass-wall', status: 'available', user: null },
    'Y4': { area: 'corridor', status: 'available', user: null }, // 專案許可區
    'Y5': { area: 'corridor', status: 'available', user: null }, // 專案許可區
    'Y6': { area: 'corridor', status: 'available', user: null }, // 專案許可區
    'Y7': { area: 'corridor', status: 'available', user: null }, // 專案許可區
    'Y8': { area: 'glass-wall', status: 'available', user: null },
    'Y9': { area: 'glass-wall', status: 'available', user: null },
    'Y10': { area: 'glass-wall', status: 'available', user: null },
    'Y11': { area: 'glass-wall', status: 'available', user: null },
    'Y12': { area: 'glass-wall', status: 'available', user: null },
    'Y13': { area: 'glass-wall', status: 'available', user: null },
    'Y14': { area: 'glass-wall', status: 'available', user: null },
    'Y15': { area: 'glass-wall', status: 'available', user: null },
    'Y16': { area: 'glass-wall', status: 'available', user: null },
    'Y17': { area: 'glass-wall', status: 'available', user: null },
    'Y18': { area: 'glass-wall', status: 'available', user: null },
    'Y19': { area: 'glass-wall', status: 'available', user: null },
    'Y20': { area: 'glass-wall', status: 'available', user: null },
    'Y21': { area: 'glass-wall', status: 'available', user: null },
    'Y22': { area: 'glass-wall', status: 'available', user: null },
    'Y23': { area: 'glass-wall', status: 'available', user: null },
    'Y24': { area: 'glass-wall', status: 'available', user: null },
    'Y25': { area: 'glass-wall', status: 'available', user: null },
    'Y26': { area: 'glass-wall', status: 'available', user: null },

    // 柱子 Pillar
    'Z1': { area: 'pillar', status: 'available', user: null },
    'Z2': { area: 'pillar', status: 'available', user: null },
    'Z3': { area: 'pillar', status: 'available', user: null },
    'Z4': { area: 'pillar', status: 'available', user: null },
    'Z5': { area: 'pillar', status: 'available', user: null },
    'Z6': { area: 'pillar', status: 'available', user: null },
    'Z7': { area: 'pillar', status: 'available', user: null },
    'Z8': { area: 'pillar', status: 'available', user: null },
    'Z9': { area: 'pillar', status: 'available', user: null },
};

// 區域對應 (大區塊)
const areaMapping: Record<string, { name: string; english: string; deposit: number; key: string; subCategoryId: string }> = {
  'Square': { name: '中庭', english: 'Square', deposit: 1000, key: 'square', subCategoryId: 'Square' },
  'Corridor': { name: '專案許可區', english: 'Case Permit Area', deposit: 1000, key: 'corridor', subCategoryId: 'CasePermitArea' },
  'Front_Terrace': { name: '前陽台', english: 'Front Terrace', deposit: 1000, key: 'front-terrace', subCategoryId: 'FrontTerrace' },
  'Back_Terrace': { name: '後陽台', english: 'Back Terrace', deposit: 2000, key: 'back-terrace', subCategoryId: 'BackTerrace' },
  'Glass_Wall': { name: '玻璃牆', english: 'Glass Wall', deposit: 1000, key: 'glass-wall', subCategoryId: 'GlassWall' },
  'Pillar': { name: '專案許可區', english: 'Case Permit Area', deposit: 1000, key: 'pillar', subCategoryId: 'CasePermitArea' },
  'Glass_Wall_Y4-Y7': { name: '專案許可區', english: 'Case Permit Area', deposit: 1000, key: 'glass-wall-y4y7', subCategoryId: 'CasePermitArea' }
};

// 子分類對應
const subCategoryToAreaKey: Record<string, string> = {
  'Square': 'square',
  'FrontTerrace': 'front-terrace',
  'BackTerrace': 'back-terrace',
  'GlassWall': 'glass-wall',
  'CasePermitArea': 'case-permit'
};

// 區塊的 area 值對應到 subCategoryId
const areaToSubCategory: Record<string, string> = {
  'square': 'Square',
  'corridor': 'CasePermitArea',
  'front-terrace': 'FrontTerrace',
  'back-terrace': 'BackTerrace',
  'glass-wall': 'GlassWall',
  'pillar': 'CasePermitArea'
};

// 縮放配置
const zoomConfigs: Record<string, { scale: number; translateX: number; translateY: number }> = {
  'square': { scale: 1.8, translateX: 7, translateY: 25 },
  'front-terrace': { scale: 2, translateX: -16, translateY: -30 },
  'back-terrace': { scale: 2.3, translateX: 25, translateY: 10 },
  'glass-wall': { scale: 1, translateX: 0, translateY: -2 },
  'case-permit': { scale: 1, translateX: 0, translateY: 0 }
};

// --- INTERFACES ---

interface TooltipInfo {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  english: string;
  deposit: number;
}

interface SpaceAreaMapProps {
  selectedSubCategory: string | null;
  onAreaClick?: (subCategoryId: string) => void;
  onBlockSelect?: (blockId: string) => void;
  selectedBlocks?: string[];
  rentedBlocks?: string[];
  cartBlocks?: string[]; // 已加入購物車的區塊
}

// --- COMPONENT ---

const SpaceAreaMap: React.FC<SpaceAreaMapProps> = ({
  selectedSubCategory,
  onAreaClick,
  onBlockSelect,
  selectedBlocks = [],
  rentedBlocks = [],
  cartBlocks = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo>({
    visible: false, x: 0, y: 0, name: '', english: '', deposit: 0
  });
  const eventListenersRef = useRef<Array<{ element: Element; type: string; handler: (e: Event) => void }>>([]);

  // 1. 先 fetch SVG 內容（只執行一次）
  useEffect(() => {
    let isMounted = true;

    fetch('/Area/A5F Area Booking.svg')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(content => {
        if (isMounted) setSvgContent(content);
      })
      .catch(err => console.error('[SpaceAreaMap] Failed to load SVG:', err));

    return () => { isMounted = false; };
  }, []);

  // 2. SVG 內容載入後，注入到 DOM
  useEffect(() => {
    if (!svgContent || !containerRef.current) return;

    containerRef.current.innerHTML = svgContent;
    const svg = containerRef.current.querySelector('svg');

    if (svg) {
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.maxHeight = '100%';
      svg.style.display = 'block';
      svg.id = 'area-booking-svg';
      svg.style.transition = 'transform 0.5s ease-in-out';
      svg.style.transformOrigin = 'center center';
      setSvgElement(svg);
    }
  }, [svgContent]);

  // Effect for ALL SVG interactions (zooming, dimming, styling, event listeners)
  useEffect(() => {
    if (!svgElement) return;

    // --- 1. Cleanup & Helpers ---
    eventListenersRef.current.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    eventListenersRef.current = [];

    const addEventListener = (element: Element, type: string, handler: (e: Event) => void) => {
      element.addEventListener(type, handler);
      eventListenersRef.current.push({ element, type, handler });
    };

    const blockElements = svgElement.querySelectorAll('g[id], path[id], rect[id], polygon[id], circle[id]');
    blockElements.forEach(el => {
      el.classList.remove('area-block', 'is-available', 'is-selected', 'is-rented', 'is-interactive', 'is-disabled');
      (el as HTMLElement).style.opacity = '1';
    });


    // --- 2. Apply Logic based on Zoom State ---
    if (selectedSubCategory) {
      // ===== ZOOMED-IN STATE =====

      // a) Apply zoom transform
      const areaKey = subCategoryToAreaKey[selectedSubCategory];
      if (areaKey && zoomConfigs[areaKey]) {
        const config = zoomConfigs[areaKey];
        svgElement.style.transform = `scale(${config.scale}) translate(${config.translateX}%, ${config.translateY}%)`;
      }

      // b) Dim other *main areas*
      Object.entries(areaMapping).forEach(([areaId, areaData]) => {
        const group = svgElement.querySelector(`#${areaId}`);
        if (group) {
          (group as HTMLElement).style.opacity = areaData.subCategoryId === selectedSubCategory ? '1' : '0.2';
        }
      });
      
      // c) Style and add listeners to individual blocks
      Object.keys(mockAreaBlocksData).forEach(blockId => {
        const blockElement = svgElement.querySelector(`#${blockId}`);
        if (blockElement) {
          const blockData = mockAreaBlocksData[blockId];
          const blockSubCategory = areaToSubCategory[blockData.area];
          const isInCurrentArea = blockSubCategory === selectedSubCategory;
          const isRented = rentedBlocks.includes(blockId) || blockData.status === 'booked';
          const isInCart = cartBlocks.includes(blockId);
          const isSelectedButNotInCart = selectedBlocks.includes(blockId) && !isInCart;

          // 找出需要套用樣式的所有元素
          const isGroupElement = blockElement.tagName.toLowerCase() === 'g';
          const elementsToStyle = isGroupElement
            ? Array.from(blockElement.querySelectorAll('path, rect, polygon, circle'))
            : [blockElement];

          // 先清除所有狀態 class（確保乾淨的狀態）
          elementsToStyle.forEach(el => {
            el.classList.remove('is-available', 'is-selected', 'is-rented', 'is-interactive', 'is-disabled');
          });

          // 再添加新的狀態 class
          elementsToStyle.forEach(el => {
            el.classList.add('area-block');
            if (isRented) {
              el.classList.add('is-rented');
            } else if (isInCart) {
              // 已加入購物車的區塊顯示為已選擇狀態（綠色），且可以點擊移除
              el.classList.add('is-selected', 'is-interactive');
            } else if (!isInCurrentArea) {
              // 不在當前選擇區域內的區塊：禁用狀態（暗灰色，30% 不透明度）
              el.classList.add('is-disabled');
            } else {
              // 在當前選擇區域內的區塊：可互動
              // 選中但未加入購物車的區塊顯示為選中狀態（綠色）
              el.classList.add(isSelectedButNotInCart ? 'is-selected' : 'is-available', 'is-interactive');
            }
          });

          // 設置 <g> 元素的 cursor（如果是 group）
          if (isGroupElement) {
            if (isInCurrentArea && !isRented) {
              (blockElement as HTMLElement).style.cursor = 'pointer';
            } else {
              (blockElement as HTMLElement).style.cursor = 'default';
            }
          }

          // 只有在當前區域內、未租出的區塊才能被選擇（包含已在購物車中的，點擊可移除）
          if (isInCurrentArea && !isRented && onBlockSelect) {
            const clickHandler = (e: Event) => {
              e.stopPropagation();
              onBlockSelect(blockId);
            };
            addEventListener(blockElement, 'click', clickHandler);
          }
        }
      });

    } else {
      // ===== ZOOMED-OUT STATE =====
      svgElement.style.transform = 'scale(1) translate(0%, 0%)';

      // 在外層顯示購物車中的區塊
      Object.keys(mockAreaBlocksData).forEach(blockId => {
        const blockElement = svgElement.querySelector(`#${blockId}`);
        if (blockElement) {
          const isInCart = cartBlocks.includes(blockId);
          const isRented = rentedBlocks.includes(blockId) || mockAreaBlocksData[blockId].status === 'booked';

          const elementsToStyle = blockElement.tagName.toLowerCase() === 'g'
            ? Array.from(blockElement.querySelectorAll('path, rect, polygon, circle'))
            : [blockElement];

          // 先清除所有狀態 class
          elementsToStyle.forEach(el => {
            el.classList.remove('is-available', 'is-selected', 'is-rented', 'is-interactive', 'is-disabled');
          });

          // 再添加新的狀態 class
          elementsToStyle.forEach(el => {
            el.classList.add('area-block');
            if (isRented) {
              el.classList.add('is-rented');
            } else if (isInCart) {
              el.classList.add('is-selected');
            } else {
              el.classList.add('is-available');
            }
          });
        }
      });

      Object.entries(areaMapping).forEach(([areaId, areaData]) => {
        const group = svgElement.querySelector(`#${areaId}`);
        if (group) {
          (group as HTMLElement).style.cursor = 'pointer';

          if (onAreaClick) {
            const clickHandler = (e: Event) => {
              e.stopPropagation();
              onAreaClick(areaData.subCategoryId);
            };
            addEventListener(group, 'click', clickHandler);
          }

          const mouseEnterHandler = (e: MouseEvent) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, ...areaData });
          const mouseMoveHandler = (e: MouseEvent) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
          const mouseLeaveHandler = () => setTooltip(prev => ({ ...prev, visible: false }));

          addEventListener(group, 'mouseenter', mouseEnterHandler as (e: Event) => void);
          addEventListener(group, 'mousemove', mouseMoveHandler as (e: Event) => void);
          addEventListener(group, 'mouseleave', mouseLeaveHandler);
        }
      });
    }
  }, [svgElement, selectedSubCategory, onAreaClick, onBlockSelect, selectedBlocks, rentedBlocks, cartBlocks]);


  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
        style={{ overflow: 'hidden' }}
      >
        {/* 只在 SVG 還沒載入時顯示 loading */}
        {!svgContent && (
          <div className="text-gray-scale2 text-center">
            <p className="font-['Inter',_sans-serif]">Loading floor plan...</p>
            <p className="font-['Noto_Sans_TC',_sans-serif]">載入平面圖中...</p>
          </div>
        )}
      </div>

      {tooltip.visible && !selectedSubCategory && (
        <div
          className="fixed pointer-events-none z-50 bg-black/80 px-4 py-3 min-w-[200px]"
          style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}
        >
          <p className="text-white text-small-title font-medium mb-2">
            <span className="font-['Inter',_sans-serif]">{tooltip.english}</span>{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">{tooltip.name}</span>
          </p>
          <div className="flex justify-between items-center mb-1">
            <span className="font-['Inter',_sans-serif] text-gray-scale2 text-tiny">Deposit/Pcs</span>
            <span className="font-['Inter',_sans-serif] text-white text-tiny">NT$ {tooltip.deposit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 text-tiny">押金/塊</span>
          </div>
          <div className="border-t border-gray-scale3 my-3"></div>
          <div>
            <p className="font-['Inter',_sans-serif] text-white text-tiny">Click to Book</p>
            <p className="font-['Noto_Sans_TC',_sans-serif] text-white text-tiny">點擊區塊以開始租借</p>
          </div>
        </div>
      )}
    </>
  );
};

export default SpaceAreaMap;
