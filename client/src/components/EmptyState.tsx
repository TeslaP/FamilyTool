import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="text-center py-12">
      {icon && <div className="text-stone-300 mb-3 flex justify-center">{icon}</div>}
      <h3 className="text-sm font-medium text-stone-900">{title}</h3>
      <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
