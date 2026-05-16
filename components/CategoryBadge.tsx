import type { TriageCategory } from "@/lib/types";

export function CategoryBadge({ category }: { category: TriageCategory }) {
  return (
    <span className="cat" data-cat={category}>
      {category}
    </span>
  );
}
