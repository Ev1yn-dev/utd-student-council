// School executives and teacher advisors shown with the committee (public.advisors, staff_group). Their introduction
// card and square avatar are files in public/images/council (paths stored on the row).

export type StaffGroup = "advisor" | "executive";

export type StaffMember = {
  id: string;
  /** display order inside a group */
  order: number;
  group: StaffGroup;
  name: string;
  nickname?: string;
  role: string;
  /** full introduction card (path under /images/council/cards) and its size; "" = none */
  card: string;
  cardW?: number;
  cardH?: number;
  /** square avatar, 400×400; "" = none */
  avatar: string;
};
