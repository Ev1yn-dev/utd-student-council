-- The public site reads members / advisors with the anon key through column-level grants (0002 / 0003 / 0009 / 0013).
-- Extend them with the roster columns added in 0020 (introduction card, avatar, staff group). instagram / contact stay
-- ungranted (served through the service role, consented rows only).
grant select (card_path, card_w, card_h, avatar_path) on public.members to anon;
grant select (staff_group, card_path, card_w, card_h, avatar_path) on public.advisors to anon;
