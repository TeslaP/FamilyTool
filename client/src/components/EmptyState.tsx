import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="text-center py-16">
      {icon && <div className="text-stone-300 mb-4 flex justify-center">{icon}</div>}
      <h3 className="text-base font-medium text-stone-900">{title}</h3>
      <p className="text-base text-stone-500 mt-2 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
