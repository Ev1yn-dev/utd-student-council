import data from "@/content/council-departments.json";
import type { Department } from "@/lib/council";

/** Council departments in display order (content/council-departments.json). */
export const DEPARTMENTS: (Department & { aliases?: string[] })[] = data.departments;

export const deptByKey = (key: string | null | undefined) => DEPARTMENTS.find((d) => d.key === key) ?? null;
/** Department key from a Thai label (old rows, the roster file), with or without the "ฝ่าย" prefix; aliases count. */
export const deptKeyFromLabel = (label: string) => {
  const t = label.trim().replace(/^ฝ่าย/, "");
  return DEPARTMENTS.find((d) => d.th === t || d.aliases?.includes(t))?.key ?? null;
};
