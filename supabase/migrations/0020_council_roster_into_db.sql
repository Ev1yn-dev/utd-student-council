-- The council roster of 2569 moves from src/data/council-members.json + public/images/council/leaders.json into the
-- database, so the public site and the back office read and edit the same rows (generated once from those files,
-- which are deleted in the same commit). Re-running is harmless: rows are matched by name, staff only inserted once.
--
-- members: + card_path / card_w / card_h / avatar_path (introduction card + square avatar shipped in public/images/council).
--   A row with a card shows it on the site (the people on the roster agreed to it); otherwise the consent rules apply.
-- advisors: + staff_group ('advisor' = teacher advisor, 'executive' = school executive) and the same image columns.

alter table public.members add column if not exists card_path text check (card_path is null or card_path ~ '^/images/council/cards/[a-z0-9-]+\.webp$');
alter table public.members add column if not exists card_w integer;
alter table public.members add column if not exists card_h integer;
alter table public.members add column if not exists avatar_path text check (avatar_path is null or avatar_path ~ '^/images/council/avatars/[a-z0-9-]+\.webp$');
alter table public.advisors add column if not exists staff_group text not null default 'advisor' check (staff_group in ('advisor', 'executive'));
alter table public.advisors add column if not exists card_path text check (card_path is null or card_path ~ '^/images/council/cards/[a-z0-9-]+\.webp$');
alter table public.advisors add column if not exists card_w integer;
alter table public.advisors add column if not exists card_h integer;
alter table public.advisors add column if not exists avatar_path text check (avatar_path is null or avatar_path ~ '^/images/council/avatars/[a-z0-9-]+\.webp$');

-- same person in both sources: spaces and the title prefix (นาย / นางสาว / นาง) are ignored
create or replace function pg_temp.name_key(v text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(normalize(coalesce(v, ''), NFC), '\s+', '', 'g'), '^(นางสาว|นาง|นาย)', '')
$$;

insert into public.academic_years (year, is_current) values (2569, false) on conflict (year) do nothing;

-- 1) students on the roster: an existing row (by name) takes the file's nickname, department, role, party, IG and card;
--    anyone else is added (approved, after the stored people of the year)
create temp table roster_src (name text, ord integer, nickname text, dept text, dept_en text, dept_key text, role_title text,
  council_role text, party text, instagram text, card_path text, card_w integer, card_h integer, avatar_path text) on commit drop;
insert into roster_src values
('นายกฤษณะ บุญอินเขียว', 1, 'โฟกัส', 'ประชาสัมพันธ์', 'Public Relations', 'publicRelations', 'สมาชิกฝ่ายประชาสัมพันธ์', 'member', 'อิสระ', 'krxt_focus', '/images/council/cards/krissana.webp', 720, 938, '/images/council/avatars/krissana.webp'),
('นางสาวนภัทร เทศปาน', 2, 'อลัน', 'ประชาสัมพันธ์', 'Public Relations', 'publicRelations', 'สมาชิกฝ่ายประชาสัมพันธ์', 'member', 'The Bright Path', 'axlevk_hw', '/images/council/cards/naphat.webp', 720, 938, '/images/council/avatars/naphat.webp'),
('นางสาวศุภานัน โภชนจันทร์', 3, 'ต้นข้าว', 'เลขานุการ', 'Secretariat', 'secretariat', 'สมาชิกฝ่ายเลขานุการ', 'member', 'The Bright Path', 'aixla_10', '/images/council/cards/suphanan.webp', 720, 938, '/images/council/avatars/suphanan.webp'),
('นายกิตตินันท์ กรรณิการ์', 4, 'บูม', 'เลขานุการ', 'Secretariat', 'secretariat', 'สมาชิกฝ่ายเลขานุการ', 'member', 'The Bright Path', 'bozm.x', '/images/council/cards/kittinan.webp', 720, 938, '/images/council/avatars/kittinan.webp'),
('นางสาวสุพิชญานันท์ บุญเรศ', 5, 'ปุกปั้น', 'นโยบายและแบบแผน', 'Policy and Planning', 'policy', 'สมาชิกฝ่ายนโยบายและแบบแผน', 'member', 'อิสระ', 'uus4pitoop4pkkpn_', '/images/council/cards/suphitchayanan.webp', 720, 938, '/images/council/avatars/suphitchayanan.webp'),
('นางสาวปภาวรินทร์ สุขคำ', 6, 'พรรษา', 'นโยบายและแบบแผน', 'Policy and Planning', 'policy', 'สมาชิกฝ่ายนโยบายและแบบแผน', 'member', 'อิสระ', 'papxawar1n', '/images/council/cards/paphawarin.webp', 720, 938, '/images/council/avatars/paphawarin.webp'),
('นางสาวชญาดา พาลี', 7, 'ไอซ์', 'อาคารสถานที่และปฏิคม', 'Facilities and Hospitality', 'facilities', 'สมาชิกฝ่ายอาคารสถานที่และปฏิคม', 'member', 'อิสระ', 'ker_qx0', '/images/council/cards/chayada.webp', 720, 938, '/images/council/avatars/chayada.webp'),
('นายประกายเพชร ไชยทิง', 8, null, 'อาคารสถานที่และปฏิคม', 'Facilities and Hospitality', 'facilities', 'สมาชิกฝ่ายอาคารสถานที่และปฏิคม', 'member', null, null, '/images/council/cards/prakaiphet.webp', 720, 938, '/images/council/avatars/prakaiphet.webp'),
('นายวรวิก จันทร์ตาคำ', 9, 'เนเน่', 'กิจกรรมและนันทนาการ', 'Activities and Recreation', 'activities', 'สมาชิกฝ่ายกิจกรรมและนันทนาการ', 'member', 'อิสระ', 'hojigst44_', '/images/council/cards/worawik.webp', 720, 938, '/images/council/avatars/worawik.webp'),
('นางสาวณัฐพร จอมดวง', 10, 'ญี่ปุ่น', 'กิจกรรมและนันทนาการ', 'Activities and Recreation', 'activities', 'สมาชิกฝ่ายกิจกรรมและนันทนาการ', 'member', 'อิสระ', 'ur_symphonynumber5', '/images/council/cards/nattaporn.webp', 720, 938, '/images/council/avatars/nattaporn.webp'),
('นางสาวนภัสรา ชูอาวุธ', 11, 'น้ำขิง', 'เหรัญญิก', 'Treasury', 'treasury', 'สมาชิกฝ่ายเหรัญญิก', 'member', 'อิสระ', 'naphsar_', '/images/council/cards/naphatsara.webp', 720, 938, '/images/council/avatars/naphatsara.webp'),
('นางสาววรัชยา จันทร์ฟู', 12, 'ต้นอ้อ', 'เหรัญญิก', 'Treasury', 'treasury', 'สมาชิกฝ่ายเหรัญญิก', 'member', 'อิสระ', 'waratchaya_.j', '/images/council/cards/waratchaya.webp', 720, 938, '/images/council/avatars/waratchaya.webp'),
('นางสาวณัฐณิชา ยอดถา', 13, 'ปราย', 'สวัสดิการ', 'Welfare', 'welfare', 'สมาชิกฝ่ายสวัสดิการ', 'member', 'อิสระ', 'natnicha.190', '/images/council/cards/natnicha-y.webp', 720, 938, '/images/council/avatars/natnicha-y.webp'),
('นางสาวสิริกัลยารัตน์ ผาเพชร', 14, 'ทิวลิป', 'สวัสดิการ', 'Welfare', 'welfare', 'สมาชิกฝ่ายสวัสดิการ', 'member', 'อิสระ', 'sp_tulxp', '/images/council/cards/sirikanyarat.webp', 720, 938, '/images/council/avatars/sirikanyarat.webp'),
('นางสาวภวรัญชน์ ถาคำ', 15, 'เอย', 'ศิลปะและวัฒนธรรม', 'Arts and Culture', 'arts', 'สมาชิกฝ่ายศิลปวัฒนธรรม', 'member', 'อิสระ', 'peepenraikrub', '/images/council/cards/phawaran.webp', 720, 938, '/images/council/avatars/phawaran.webp'),
('นายขุนพล ทาบัว', 16, 'บู๊', 'ศิลปะและวัฒนธรรม', 'Arts and Culture', 'arts', 'สมาชิกฝ่ายศิลปวัฒนธรรม', 'member', 'อิสระ', 'l0punhk.bo.tb', '/images/council/cards/khunphon.webp', 720, 938, '/images/council/avatars/khunphon.webp'),
('นางสาวปราณปรียา พรหมรังษี', 17, 'เกรฟ', 'ระเบียบวินัย', 'Discipline', 'discipline', 'สมาชิกฝ่ายระเบียบวินัย', 'member', 'อิสระ', 'grapeurfavb4e_', '/images/council/cards/pranpriya.webp', 720, 938, '/images/council/avatars/pranpriya.webp'),
('นายชิษณุพงศ์ สุขประเสริฐ', 18, 'ตั้งโอ๋', 'ระเบียบวินัย', 'Discipline', 'discipline', 'สมาชิกฝ่ายระเบียบวินัย', 'member', 'อิสระ', 'tangoh_04', '/images/council/cards/chitsanuphong.webp', 720, 938, '/images/council/avatars/chitsanuphong.webp'),
('นางสาวณัฐณิชา เป็งเนตร์', 19, 'แอปเปิ้ล', 'วัดผลและประเมินผล', 'Measurement and Evaluation', 'evaluation', 'สมาชิกฝ่ายวัดผลและประเมินผล', 'member', 'อิสระ', 'maybeplxxol', '/images/council/cards/natnicha-p.webp', 720, 938, '/images/council/avatars/natnicha-p.webp'),
('นางสาวสิริสุทัตตา วชิรสอนเสนา', 20, 'สกาย', 'วัดผลและประเมินผล', 'Measurement and Evaluation', 'evaluation', 'สมาชิกฝ่ายวัดผลและประเมินผล', 'member', 'อิสระ', 'skyline_09ll', '/images/council/cards/sirisutatta.webp', 720, 938, '/images/council/avatars/sirisutatta.webp'),
('นางสาวธัญลักษณ์ เจตเกษกิจ', 21, 'ปรายฟ้า', 'โสตทัศนศึกษา', 'Audio-Visual Services', 'audioVisual', 'สมาชิกฝ่ายโสตทัศนูปกรณ์', 'member', 'อิสระ', 'siosysk_', '/images/council/cards/thanyalak.webp', 720, 938, '/images/council/avatars/thanyalak.webp');

update public.members m set
  nickname = coalesce(s.nickname, m.nickname), dept = coalesce(s.dept, m.dept), dept_en = coalesce(s.dept_en, m.dept_en),
  dept_key = coalesce(s.dept_key, m.dept_key), role_title = s.role_title, council_role = s.council_role,
  party = coalesce(s.party, m.party), instagram = coalesce(s.instagram, m.instagram),
  consent_public = m.consent_public or s.instagram is not null,
  card_path = s.card_path, card_w = s.card_w, card_h = s.card_h, avatar_path = s.avatar_path
from roster_src s
where m.year = 2569 and pg_temp.name_key(m.name) = pg_temp.name_key(s.name);

insert into public.members (year, name, nickname, dept, dept_en, dept_key, role_title, council_role, party, instagram, consent_public,
  card_path, card_w, card_h, avatar_path, sort_order, status)
select 2569, s.name, coalesce(s.nickname, ''), coalesce(s.dept, ''), coalesce(s.dept_en, ''), s.dept_key, s.role_title, s.council_role, coalesce(s.party, ''), coalesce(s.instagram, ''),
  s.instagram is not null, s.card_path, s.card_w, s.card_h, s.avatar_path, 1000 + s.ord, 'approved'
from roster_src s
where not exists (select 1 from public.members m where m.year = 2569 and pg_temp.name_key(m.name) = pg_temp.name_key(s.name));

-- 2) leaders (president, vice presidents, heads) stay their rows; the card replaces the stored photo and the file's
--    spelling replaces misspelled names (aliases)
create temp table leader_src (match_name text, name text, card_path text, card_w integer, card_h integer, avatar_path text) on commit drop;
insert into leader_src values
('นายชนะชัย ใจจีน', 'นายชนะชัย ใจจีน', '/images/council/cards/chanachai.webp', 720, 900, '/images/council/avatars/chanachai.webp'),
('นางสาวกชกร ปลื้มพันธุ์', 'นางสาวกชกร ปลื้มพันธุ์', '/images/council/cards/kotchakorn.webp', 720, 900, '/images/council/avatars/kotchakorn.webp'),
('นางสาวธนัชชา ใคร้คง', 'นางสาวธนัชชา ใคร้คง', '/images/council/cards/thanatcha.webp', 720, 900, '/images/council/avatars/thanatcha.webp'),
('นางสาวพิมญาดา วาทีตรง', 'นางสาวพิมญาดา วาทีตรง', '/images/council/cards/pimyada.webp', 720, 900, '/images/council/avatars/pimyada.webp'),
('นางสาวนุชนาถ สิงกา', 'นางสาวนุชนาถ สิงกา', '/images/council/cards/nutchanat.webp', 720, 900, '/images/council/avatars/nutchanat.webp'),
('นายศุภฤกษ์ จันมี', 'นายศุภฤกษ์ จันมี', '/images/council/cards/suphalerk.webp', 720, 900, '/images/council/avatars/suphalerk.webp'),
('นางสาววรวิพัณณ์ ธนเดชสิริพงศ์', 'นางสาววรวิพัณณ์ ธนเดชสิริพงศ์', '/images/council/cards/worawipan.webp', 720, 900, '/images/council/avatars/worawipan.webp'),
('นางสาวรวิพัณณ์ ธนเดชสิริพงศ์', 'นางสาววรวิพัณณ์ ธนเดชสิริพงศ์', '/images/council/cards/worawipan.webp', 720, 900, '/images/council/avatars/worawipan.webp'),
('นางสาวณัฐณิชา ทองคำ', 'นางสาวณัฐณิชา ทองคำ', '/images/council/cards/natnicha-t.webp', 720, 900, '/images/council/avatars/natnicha-t.webp'),
('นางสาวอริญรดา กุศล', 'นางสาวอริญรดา กุศล', '/images/council/cards/arinrada.webp', 720, 900, '/images/council/avatars/arinrada.webp'),
('นางสาวชญาภรณ์ มหาวัน', 'นางสาวชญาภรณ์ มหาวัน', '/images/council/cards/chayaporn.webp', 720, 900, '/images/council/avatars/chayaporn.webp'),
('นางสาวชญารณ์ มหาวัน', 'นางสาวชญาภรณ์ มหาวัน', '/images/council/cards/chayaporn.webp', 720, 900, '/images/council/avatars/chayaporn.webp'),
('นายสิรวิชญ์ จุ้ยสะวะ', 'นายสิรวิชญ์ จุ้ยสะวะ', '/images/council/cards/sirawit.webp', 720, 900, '/images/council/avatars/sirawit.webp'),
('นางสาวชญานี มีแก้ว', 'นางสาวชญานี มีแก้ว', '/images/council/cards/chayanee.webp', 720, 900, '/images/council/avatars/chayanee.webp'),
('นายกิตติกวิน สีทา', 'นายกิตติกวิน สีทา', '/images/council/cards/kittikawin.webp', 720, 900, '/images/council/avatars/kittikawin.webp'),
('นายพีรภัทร โตม่วง', 'นายพีรภัทร โตม่วง', '/images/council/cards/peerapat.webp', 720, 900, '/images/council/avatars/peerapat.webp'),
('นางสาวประกายฟ้า แสงซื่อ', 'นางสาวประกายฟ้า แสงซื่อ', '/images/council/cards/prakaifah.webp', 720, 900, '/images/council/avatars/prakaifah.webp'),
('นางสาวชญานิศ เชื้อบาง', 'นางสาวชญานิศ เชื้อบาง', '/images/council/cards/chayanit.webp', 720, 900, '/images/council/avatars/chayanit.webp');

update public.members m set name = s.name, card_path = s.card_path, card_w = s.card_w, card_h = s.card_h, avatar_path = s.avatar_path
from leader_src s
where m.year = 2569 and pg_temp.name_key(m.name) = pg_temp.name_key(s.match_name);

-- 3) teacher advisors and school executives
insert into public.advisors (year, name, nickname, role_label, staff_group, sort_order, instagram, consent_public, card_path, card_w, card_h, avatar_path, status)
select 2569, s.name, coalesce(s.nickname, ''), s.role_label, s.staff_group, s.ord, coalesce(s.instagram, ''), s.instagram is not null, s.card_path, s.card_w, s.card_h, s.avatar_path, 'approved'
from (values
('นายอัศวิน วงศ์พุ่ม', null, 'หัวหน้ากลุ่มงานส่งเสริมประชาธิปไตยในโรงเรียน และหัวหน้าครูที่ปรึกษาสภานักเรียน', 'advisor', 22, null, '/images/council/cards/atsawin.webp', 720, 938, '/images/council/avatars/atsawin.webp'),
('นายนิพนธ์ หมูทอง', null, 'หัวหน้างานกิจกรรมนักเรียน และครูที่ปรึกษาสภานักเรียน', 'advisor', 23, null, '/images/council/cards/niphon.webp', 720, 938, '/images/council/avatars/niphon.webp'),
('นายธนัชพงศ์ บรรดิษฐ์ศักดิ์', null, 'ครูที่ปรึกษาสภานักเรียน', 'advisor', 24, null, '/images/council/cards/thanatchaphong.webp', 720, 938, '/images/council/avatars/thanatchaphong.webp'),
('นางสาวเบญจมาศ กลิ่นเชตุ', null, 'ครูที่ปรึกษาสภานักเรียน', 'advisor', 25, null, '/images/council/cards/benjamas.webp', 720, 938, '/images/council/avatars/benjamas.webp'),
('นางสาวบุญญาวัลย์ จันโท', null, 'ครูที่ปรึกษาสภานักเรียน', 'advisor', 26, null, '/images/council/cards/bunyawan.webp', 720, 938, '/images/council/avatars/bunyawan.webp'),
('นายนิธิพัฒน์ ไพเราะ', null, 'ครูที่ปรึกษาสภานักเรียน', 'advisor', 27, null, '/images/council/cards/nithiphat.webp', 720, 938, '/images/council/avatars/nithiphat.webp'),
('นางสาวนพหทัยกมณ บุญอิ่ม', null, 'ครูที่ปรึกษาสภานักเรียน', 'advisor', 28, null, '/images/council/cards/nophathaikamon.webp', 720, 938, '/images/council/avatars/nophathaikamon.webp'),
('นายสังวาล เอ็บมูล', null, 'ผู้อำนวยการโรงเรียนอุตรดิตถ์', 'executive', 29, null, '/images/council/cards/sangwan.webp', 720, 938, '/images/council/avatars/sangwan.webp'),
('นางสาวฤทธี กุลพรม', null, 'รองผู้อำนวยการกลุ่มบริหารบุคคล', 'executive', 30, null, '/images/council/cards/ritthee.webp', 720, 938, '/images/council/avatars/ritthee.webp'),
('นายวงกต จุลรังสี', null, 'หัวหน้ากลุ่มงานกิจการนักเรียน', 'executive', 31, null, '/images/council/cards/wongkot.webp', 720, 938, '/images/council/avatars/wongkot.webp')
) as s(name, nickname, role_label, staff_group, ord, instagram, card_path, card_w, card_h, avatar_path)
where not exists (select 1 from public.advisors a where a.year = 2569 and pg_temp.name_key(a.name) = pg_temp.name_key(s.name));
