-- =============================================================
-- 2026-11-07 設備、組合、教室的英文名稱：後台可編輯，前台 EN 模式顯示，空白退回中文
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（可重複執行）
-- 只填還沒有英文名的項目，後台改過的不會被蓋掉。重新 seed 設備後再跑一次即可。
-- 教室先帶入前台原本寫死的英文名；編號區的格子只有編號，不用英文名。
-- 設備是第一版翻譯（2026-11-07），用詞由學會校對，直接在後台設備管理改。
-- =============================================================

alter table public.equipment add column if not exists en_name text;
alter table public.equipment_bundles add column if not exists en_name text;
alter table public.space add column if not exists en_name text;

update public.space set en_name = id || ' Classroom' where area = 'classroom' and en_name is null;

update public.equipment e
set en_name = v.en_name
from (values
  -- 展版／展桌／展台
  ('#MASA001', 'Drawing Board'),
  ('#MASA002', 'Drawing Board Stand'),
  ('#MASB001', 'Black Display Table Leg / 100'),
  ('#MASB002', 'Black Display Table Support Bar / 60'),
  ('#MASB003', 'Black Display Table Support Bar / 90'),
  ('#MASB004', 'Black Display Table Support Bar / 120'),
  ('#MASB005', 'Black Display Table Support Bar / 180'),
  ('#MASB006', 'White Wooden Tabletop / 120*60'),
  ('#MASB007', 'White Wooden Tabletop / 61*61'),
  ('#MASB008', 'White Wooden Tabletop / 180*60'),
  ('#MASB009', 'Black Display Table Support Bar / 150'),
  ('#MASB010', 'Black Display Table Support Bar / 240'),
  ('#MASC001', 'Truss Joint'),
  ('#MASC002', 'Truss / 100'),
  ('#MASC003', 'Truss / 200'),
  ('#MASD001', 'A-Frame Wall (Wheeled) / 60*122*190'),
  ('#MASD002', '3-Panel Folding Wall (Wheeled) / 92*185'),
  ('#MASD003', 'H-Frame Wall / 92*200'),
  ('#MASD004', 'White Notice Wall / 46*216'),
  ('#MASD005', 'Large Clear Fluted Panel / 215*205'),
  ('#MASD006', 'Small Clear Fluted Panel / 150*205'),
  ('#MASE001', 'Black Plinth / 45*45*121'),
  ('#MASE002', 'Black Plinth / 30*30*103'),
  ('#MASE003', 'Black Plinth / 30*30*101'),
  ('#MASE004', 'Black Plinth / 25*25*101'),
  ('#MASF101', 'A1 / 120*60*100 (Cable Hole + Small Door)'),
  ('#MASF102', 'A2 / 100*50*100'),
  ('#MASF201', 'B1 / 60*60*100 (One 60*100 Face Hollow)'),
  ('#MASF202', 'B2 / 60*60*100 (Cable Hole + Small Door)'),
  ('#MASF301', 'C1 / 37*37*70'),
  ('#MASF302', 'C2 / 37*37*100'),
  ('#MASF303', 'C3 / 45*45*99 (One 45*99 Face Hollow)'),
  ('#MASF304', 'C4 / 45*45*92'),
  ('#MASF305', 'C5 / 45*45*90'),
  ('#MASF306', 'C6 / 50*50*70'),
  ('#MASF307', 'C7 / 45*60*60'),
  ('#MASF401', 'D1 / 45*90*90'),
  ('#MASF402', 'D2 / 42*78*78 (One 78*78 Face Hollow)'),
  ('#MASF501', 'E1 / 52*52*52 (Cube)'),
  ('#MASF502', 'E2 / 45*45*45 (Cube)'),
  ('#MASF503', 'E3 / 40*40*40 (Cube)'),
  ('#MASF504', 'E4 / 33*33*37 (Two Sides with 5 cm Cutouts)'),
  ('#MASF601', 'F1 / 32*120*120'),
  ('#MASF602', 'F2 / 40*40*20'),
  ('#MASF701', 'G1 / 149*149*15 (Round Disc)'),
  ('#MASF702', 'F3 / 60*30*100'),
  ('#MASG001', 'Small Tabletop (Cross Slot)'),
  ('#MASG002', 'Small Tabletop Leg (Center Slot)'),
  ('#MASG003', 'Large Tabletop (Cross Slot)'),
  ('#MASG004', 'Large Tabletop Leg (Center Slot)'),
  -- 工具
  ('#MFSA001', 'Aluminum Ladder / 115'),
  ('#MFSA003', 'Aluminum Ladder / 175'),
  ('#MFSA004', 'Aluminum Ladder / 310 (Folding A-Frame)'),
  ('#MFSB001', 'Large Flatbed Cart (Black)'),
  ('#MFSB002', 'Large Shopping Cart (Silver)'),
  ('#MFSB003', 'Small Shopping Cart (Dark Gray)'),
  ('#MFSB004', 'Small Flatbed Cart (Orange/Black)'),
  -- 機具
  ('#MGSA001', 'Laser Cutter'),
  -- 燈具
  ('#MESA001', 'Slim Arm Desk Lamp [Warm Light]'),
  ('#MESA002', 'Xiaomi Mijia Desk Lamp'),
  ('#MESA003', 'Bent Arm Desk Lamp (14mm Warm Bulb Included)'),
  ('#MESB001', 'Silver Lightning Lamp [3-Step]'),
  ('#MESB002', 'Black Lightning Lamp [Warm Light]'),
  ('#MESB004', 'Black Lightning Lamp [3-Step]'),
  ('#MESC001', 'Black Long-Arm Tube Clamp Lamp [White Light]'),
  ('#MESC002', 'Small Donut Clamp Lamp (Micro USB Power)'),
  ('#MESC003', 'White Long-Arm Tube Clamp Lamp [White Light]'),
  ('#MESC004', 'Small Black Bent-Arm Lamp (Screw Mount) [White Light]'),
  ('#MESD001', 'Large Black Cone Clamp Lamp (Bulb Borrowed Separately)'),
  ('#MESD002', 'Black Cone Clamp Lamp, Bent Arm (Bulb Borrowed Separately)'),
  ('#MESD003', 'Black Cone Lamp, Long Arm (Screw Mount) (Bulb Borrowed Separately)'),
  ('#MESD004', 'White Cone Clamp Lamp, Long Arm (Bulb Borrowed Separately)'),
  ('#MESD005', 'White Cone Clamp Lamp, Bent Arm (Bulb Borrowed Separately)'),
  ('#MESE002', 'Light Bulb [White Light]'),
  ('#MESE003', 'Light Bulb [Warm Light]'),
  ('#MESF001', 'Moving Head Light (Square)'),
  ('#MESF002', 'Moving Head Light (Round)'),
  ('#MESF003', 'Moving Head Light Power Cable'),
  ('#MESF004', '3-Pin DMX Cable (3m*2, 5m*3, 10m*1)'),
  ('#MESG001', 'White Flexible Track Light (Large) [Natural Light]'),
  ('#MESG002', 'Black Track Light (Wide Tube) [Natural Light]'),
  ('#MESG003', 'Black Track Light (Slim Tube) [Natural Light]'),
  ('#MESG004', 'White Track Light (Long Tube) [Natural Light]'),
  -- 視聽
  ('#MDSA001', 'Square TV (Works with [Cables] - [RCA Cable / White Box (HDMI-AV)], Book Separately)'),
  ('#MDSA002', 'Broken Square TV (For Mapping)'),
  ('#MDSA003', 'Computer Monitor #1~15'),
  ('#MDSA004', 'Computer Monitor #16'),
  ('#MDSA005', 'Computer Monitor #17'),
  ('#MDSA007', 'Computer Monitor #19'),
  ('#MDSA008', 'Computer Monitor #20'),
  ('#MDSA010', 'Computer Monitor #22 (Power Cable Included)'),
  ('#MDSB001', 'iCON i-key 25-Key MIDI Controller Keyboard'),
  ('#MDSB002', 'ZeRO SL MkII MIDI Controller'),
  ('#MDSC001', 'Audio-Technica Over-Ear Headphones'),
  ('#MDSD001', 'Desktop Bluetooth Speaker (Micro-B Charging Cable and 3.5mm Male-to-Male Audio Cable Included)'),
  -- 線材
  ('#MBSA001', 'IEC Power Cable, Standard (Black) (Long*6, Short*76)'),
  ('#MBSB001', 'DVI-D (Male) - (Male)'),
  ('#MBSB002', 'DVI-D (Male) - HDMI (Male)'),
  ('#MBSC001', 'HDMI (Male) - HDMI (Male)'),
  ('#MBSC002', 'HDMI (Male) - mini HDMI (Male)'),
  ('#MBSD001', 'VGA (Male) - (Male)'),
  ('#MBSD002', 'VGA (Male) - (Female)'),
  ('#MBSD003', 'VGA (Male) - HDMI (Male) + 3.5mm'),
  ('#MBSE001', 'DP (Male) - (Male)'),
  ('#MBSE002', 'DP (Male) - mini DP (Male)'),
  ('#MBSF001', 'RCA Cable, 3-Color - 3-Color'),
  ('#MBSF002', 'RCA Cable, 3.5mm - 2-Color'),
  ('#MBSF003', 'White Box (HDMI-AV) (Power Cable Included)'),
  ('#MBSG001', 'Ethernet Cable'),
  ('#MBSH001', 'USB 3.0 4-Port Hub'),
  -- 電源線
  ('#MCSA001', '6-Outlet Cable Reel'),
  ('#MCSA002', 'Heavy-Duty Power Cable'),
  ('#MCSA003', '2-Prong Single-Outlet Extension Cord'),
  ('#MCSA004', '2-Prong 3-Outlet Extension Cord'),
  ('#MCSA005', '2-Prong 4-Outlet Extension Cord'),
  ('#MCSA006', '3-Prong 6-Outlet Extension Cord'),
  ('#MCSB001', 'Plug Adapter (3-Prong to 2-Prong)'),
  ('#MCSB002', '2-Prong 1-to-4 Outlet Adapter Cord')
) v(id, en_name)
where e.id = v.id and e.en_name is null;

notify pgrst, 'reload schema';
