-- SCCD Booking — 設備資料 seed（由 src/data/equipment-data.json 產生）
-- 使用方式：SQL Editor 貼上執行。可重複執行（upsert）。

insert into public.equipment (id, name, category, original_quantity, deposit, image_url, description)
values
  ('speaker-clamp-light', '黑色喇叭夾燈 長支架', '燈具', 3, 500, 'Images/Extension Cord.webp', '這款黑色喇叭夾燈專為媒體製作而設計，提供穩定的照明效果。適合各種拍攝場景，輕巧便攜，夾具堅固耐用。'),
  ('extension-cord', '三孔六座延長線', '延長線', 5, 500, 'Images/Extension Cord.webp', '高品質三孔六座延長線，適用於各種攝影設備供電需求。多重安全保護，確保設備安全運行。'),
  ('led-light', '長桿筒狀夾燈(可伸縮)【白光】', '燈具', 4, 500, 'Images/Extension Cord.webp', '長桿筒狀夾燈，可伸縮設計，白光照明。適合人像攝影和產品拍攝，低功耗高效能。'),
  ('folding-table', 'H字牆 / 92*200', '展桌/畫板', 2, 500, 'Images/Extension Cord.webp', 'H字牆展示架，尺寸92*200cm，適合展覽和活動使用。堅固耐用，收納方便。'),
  ('projector', 'KINYO PS 285B 立體擴大音響', '視聽類', 1, 500, 'Images/Extension Cord.webp', 'KINYO PS 285B 立體擴大音響，音質清晰，立體聲效果佳。適合各種音響需求使用。'),
  ('electric-screwdriver', '鋁梯 / 115', '工具', 2, 500, 'Images/Extension Cord.webp', '輕量鋁梯，高度115cm，穩固安全。適用於各種高處作業，收納方便。'),
  ('heat-gun', '雷射切割機', '機具', 1, 500, 'Images/Extension Cord.webp', '精密雷射切割機，適用於各種材料的精確切割。安全防護設計，操作穩定。'),
  ('hdmi-cable', '品字電源線 一般（黑）', '線材', 15, 500, 'Images/Extension Cord.webp', '高品質品字電源線，黑色設計。穩定可靠，適合各種電子設備連接。'),
  ('ring-light', '米家檯燈', '燈具', 2, 500, 'Images/Extension Cord.webp', '米家智能檯燈，光線柔和均勻。特別適合閱讀和工作使用，可調節亮度和色溫。'),
  ('professional-easel', '畫板', '展桌/畫板', 3, 500, 'Images/Extension Cord.webp', '畫板，角度可調，高度可調整。適合各種繪畫和展示需求，穩固耐用。'),
  ('wireless-microphone', '電腦螢幕', '視聽類', 3, 500, 'Images/Extension Cord.webp', '高解析度電腦螢幕，畫質清晰，色彩準確。適合各種工作和娛樂使用。'),
  ('utility-knife-set', '大型購物推車（銀色）', '工具', 5, 500, 'Images/Extension Cord.webp', '大型購物推車，銀色設計，載重能力強。適合各種搬運和運輸工作，操作便利。')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  original_quantity = excluded.original_quantity,
  deposit = excluded.deposit,
  image_url = excluded.image_url,
  description = excluded.description;
