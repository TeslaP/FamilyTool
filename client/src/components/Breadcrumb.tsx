import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-stone-500 mb-4">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} />}
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-stone-900">{crumb.label}</Link>
          ) : (
            <span className="text-stone-900 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
