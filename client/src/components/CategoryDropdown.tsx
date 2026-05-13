import { useMemo } from "react";
import type { Category } from "../types";
import { cn } from "../lib/utils";

interface Props {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number) => void;
  className?: string;
}

export function CategoryDropdown({ categories, value, onChange, className }: Props) {
  const grouped = useMemo(() => {
    const parents = categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    return parents.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [categories]);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "text-sm border border-stone-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900",
        className
      )}
    >
      <option value="">— Select —</option>
      {grouped.map(({ parent, children }) => (
        <optgroup key={parent.id} label={parent.name}>
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
