/**
 * 空間地圖組件
 * 載入 A5F 平面圖 SVG 並支援區域縮放與區塊選擇。
 * 未開放（後台關閉）的格子：可檢視、可放大，但畫停用色、cursor not-allowed、不能點；整區都關閉時說明框顯示「此區域目前不開放租借」。
 * 已被借走的格子放大後同樣 not-allowed；縮小狀態整區（含已借走）都是 pointer——點了是放大該區。
 */

import React, { useEffect, useRef, useState } from 'react'
import { useSpaceBlocks, useClosedSpaceIds } from '../../services/spaceService'
import { useT } from '../../stores/langStore'
import { useAreaName } from '../../services/contentService'
import { AREA_SUBCATEGORY as areaToSubCategory } from '../cart/cartHelpers'

// --- CONSTANTS ---


// 區域對應 (大區塊)
const areaMapping: Record<string, { deposit: number; key: string; subCategoryId: string }> = {
  'Square': { deposit: 1000, key: 'square', subCategoryId: 'Square' },
  'Area_F': { deposit: 1000, key: 'square', subCategoryId: 'Square' }, // F1–F6 算中庭（SVG 仍是獨立群組）
  'Corridor': { deposit: 1000, key: 'corridor', subCategoryId: 'CasePermitArea' },
  'Front_Terrace': { deposit: 1000, key: 'front-terrace', subCategoryId: 'FrontTerrace' },
  'Back_Terrace': { deposit: 2000, key: 'back-terrace', subCategoryId: 'BackTerrace' },
  'Glass_Wall': { deposit: 1000, key: 'glass-wall', subCategoryId: 'GlassWall' },
  'Pillar': { deposit: 1000, key: 'pillar', subCategoryId: 'CasePermitArea' },
  'Glass_Wall_Y4-Y7': { deposit: 1000, key: 'corridor', subCategoryId: 'CasePermitArea' } // Y4–Y7 在 DB 屬 corridor
};

// 子分類對應
const subCategoryToAreaKey: Record<string, string> = {
  'Square': 'square',
  'FrontTerrace': 'front-terrace',
  'BackTerrace': 'back-terrace',
  'GlassWall': 'glass-wall',
  'CasePermitArea': 'case-permit'
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
  subCategoryId: string; // 區域名稱用它查（後台可改英文）
  deposit: number;
  closed: boolean; // 整區未開放
}

interface SpaceAreaMapProps {
  selectedSubCategory: string | null;
  onAreaClick?: (subCategoryId: string) => void;
  onBlockSelect?: (blockId: string) => void;
  selectedBlocks?: string[];
  rentedBlocks?: string[];
  cartBlocks?: string[]; // 已加入購物車的區塊
  partialBlocks?: string[]; // 部分時段可借（橘）：你選的區間裡有幾天被佔
  onPartialClick?: (blockId: string) => void; // 點橘格 → 開選段 popup（SpacePage）
}

// --- COMPONENT ---

const SpaceAreaMap: React.FC<SpaceAreaMapProps> = ({
  selectedSubCategory,
  onAreaClick,
  onBlockSelect,
  selectedBlocks = [],
  rentedBlocks = [],
  cartBlocks = [],
  partialBlocks = [],
  onPartialClick
}) => {
  const t = useT()
  const areaName = useAreaName()
  // 區塊定義（id → 區域）來自 Supabase space_blocks；佔用狀態由 rentedBlocks prop 傳入
  const blocksData = useSpaceBlocks();
  const closedIds = useClosedSpaceIds();

  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo>({
    visible: false, x: 0, y: 0, subCategoryId: '', deposit: 0, closed: false
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
      // 格子編號是疊在格子上面的獨立 path：讓滑鼠事件穿透，hover 到編號也算 hover 到格子（游標與點擊才準）
      svg.querySelectorAll<SVGElement>('path.cls-2, path.cls-3').forEach(l => { l.style.pointerEvents = 'none'; });
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
      el.classList.remove('area-block', 'is-available', 'is-selected', 'is-rented', 'is-partial', 'is-interactive', 'is-disabled', 'is-closed');
      (el as HTMLElement).style.opacity = '1';
      (el as HTMLElement).style.cursor = ''; // 外層設的區域 pointer 不能帶進放大狀態
    });

    const shapesOf = (el: Element) =>
      el.tagName.toLowerCase() === 'g' ? Array.from(el.querySelectorAll('path, rect, polygon, circle')) : [el];
    // 未開放的格子：停用色＋not-allowed（放大、縮小都畫）
    closedIds.forEach(id => {
      const el = svgElement.querySelector(`#${id}`);
      if (!el) return;
      shapesOf(el).forEach(s => s.classList.add('area-block', 'is-closed'));
      if (el.tagName.toLowerCase() === 'g') (el as HTMLElement).style.cursor = 'not-allowed';
    });
    // 整區都沒有開放中的格子（例：後陽台未開放）；資料載入前不判定
    const openAreas = new Set(Object.values(blocksData).map(b => b.area));
    const isAreaClosed = (key: string) => Object.keys(blocksData).length > 0 && !openAreas.has(key);


    // --- 2. Apply Logic based on Zoom State ---
    svgElement.classList.toggle('is-zoomed', !!selectedSubCategory); // CSS 依此切換已借走格子的游標
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
          const isCurrent = areaData.subCategoryId === selectedSubCategory;
          (group as HTMLElement).style.opacity = isCurrent ? '1' : '0.2';
          // 放大到整區未開放的區域：整區（含格子上的文字）都是 not-allowed
          if (isCurrent && isAreaClosed(areaData.key)) (group as HTMLElement).style.cursor = 'not-allowed';
        }
      });
      
      // c) Style and add listeners to individual blocks
      Object.keys(blocksData).forEach(blockId => {
        const blockElement = svgElement.querySelector(`#${blockId}`);
        if (blockElement) {
          const blockData = blocksData[blockId];
          const blockSubCategory = areaToSubCategory[blockData.area];
          const isInCurrentArea = blockSubCategory === selectedSubCategory;
          const isRented = rentedBlocks.includes(blockId);
          const isPartial = partialBlocks.includes(blockId);
          const isInCart = cartBlocks.includes(blockId);
          const isSelectedButNotInCart = selectedBlocks.includes(blockId) && !isInCart;

          // 找出需要套用樣式的所有元素
          const isGroupElement = blockElement.tagName.toLowerCase() === 'g';
          const elementsToStyle = isGroupElement
            ? Array.from(blockElement.querySelectorAll('path, rect, polygon, circle'))
            : [blockElement];

          // 先清除所有狀態 class（確保乾淨的狀態）
          elementsToStyle.forEach(el => {
            el.classList.remove('is-available', 'is-selected', 'is-rented', 'is-partial', 'is-interactive', 'is-disabled');
          });

          // 再添加新的狀態 class
          elementsToStyle.forEach(el => {
            el.classList.add('area-block');
            if (isRented) {
              el.classList.add('is-rented');
            } else if (isPartial && isInCurrentArea && !isInCart) {
              // 部分時段（橘）：點了開選段 popup
              el.classList.add('is-partial', 'is-interactive');
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

          // 設置 <g> 元素的 cursor（如果是 group）：可選 pointer、已借走 not-allowed、其他區域 default
          if (isGroupElement) {
            (blockElement as HTMLElement).style.cursor =
              !isInCurrentArea ? 'default' : isRented ? 'not-allowed' : 'pointer';
          }

          // 只有在當前區域內、未租出的區塊才能被選擇（包含已在購物車中的，點擊可移除）
          if (isInCurrentArea && !isRented && (onBlockSelect || onPartialClick)) {
            const clickHandler = (e: Event) => {
              e.stopPropagation();
              // 橘格（部分時段、還沒在購物車）→ 開選段 popup；其餘照舊選取／移除
              if (isPartial && !isInCart && onPartialClick) onPartialClick(blockId);
              else onBlockSelect?.(blockId);
            };
            addEventListener(blockElement, 'click', clickHandler);
          }
        }
      });

    } else {
      // ===== ZOOMED-OUT STATE =====
      svgElement.style.transform = 'scale(1) translate(0%, 0%)';

      // 在外層顯示購物車中的區塊
      Object.keys(blocksData).forEach(blockId => {
        const blockElement = svgElement.querySelector(`#${blockId}`);
        if (blockElement) {
          const isInCart = cartBlocks.includes(blockId);
          const isRented = rentedBlocks.includes(blockId);
          const isPartial = partialBlocks.includes(blockId);

          const elementsToStyle = blockElement.tagName.toLowerCase() === 'g'
            ? Array.from(blockElement.querySelectorAll('path, rect, polygon, circle'))
            : [blockElement];

          // 先清除所有狀態 class
          elementsToStyle.forEach(el => {
            el.classList.remove('is-available', 'is-selected', 'is-rented', 'is-partial', 'is-interactive', 'is-disabled');
          });

          // 再添加新的狀態 class
          elementsToStyle.forEach(el => {
            el.classList.add('area-block');
            if (isRented) {
              el.classList.add('is-rented');
            } else if (isPartial && !isInCart) {
              el.classList.add('is-partial');
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

          // 押金以 DB 為準（後台整區改）：取該區任一格，查無才用上面的預設值
          const deposit = Object.values(blocksData).find(b => b.area === areaData.key)?.deposit ?? areaData.deposit;
          const closed = isAreaClosed(areaData.key);
          const mouseEnterHandler = (e: MouseEvent) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, ...areaData, deposit, closed });
          const mouseMoveHandler = (e: MouseEvent) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
          const mouseLeaveHandler = () => setTooltip(prev => ({ ...prev, visible: false }));

          addEventListener(group, 'mouseenter', mouseEnterHandler as (e: Event) => void);
          addEventListener(group, 'mousemove', mouseMoveHandler as (e: Event) => void);
          addEventListener(group, 'mouseleave', mouseLeaveHandler);
        }
      });
    }
  }, [svgElement, selectedSubCategory, onAreaClick, onBlockSelect, selectedBlocks, rentedBlocks, cartBlocks, partialBlocks, onPartialClick, blocksData, closedIds]);


  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
        style={{ overflow: 'hidden' }}
      >
        {/* 只在 SVG 還沒載入時顯示 loading */}
        {!svgContent && (
          <div className="text-gray-light text-center">
            <p>{t('Loading floor plan...', '載入平面圖中...')}</p>
          </div>
        )}
      </div>

      {tooltip.visible && !selectedSubCategory && (
        <div
          className="fixed pointer-events-none z-50 bg-black/80 rounded-xl px-4 py-3 min-w-[200px]"
          style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}
        >
          <p className="text-white text-sm font-normal mb-2">
            {areaName(tooltip.subCategoryId)}
          </p>
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-light text-xs">{t('Deposit/Pcs', '押金/塊')}</span>
            <span className="font-english text-white text-xs">NT$ {tooltip.deposit.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-mid my-3"></div>
          <div>
            <p className="text-white text-xs">
              {tooltip.closed ? t('This area is currently not open for booking', '此區域目前不開放租借') : t('Click to Book', '點擊區塊以開始租借')}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SpaceAreaMap;
