-- The council has no vice head (deputy head of a department): the 'deputy_head' role is removed.
-- Rows that still carry it become plain members, and the check no longer accepts it.
update public.members set council_role = 'member' where council_role = 'deputy_head';

alter table public.members drop constraint if exists members_council_role_check;
alter table public.members add constraint members_council_role_check
  check (council_role in ('president', 'vice_president', 'head', 'member'));
