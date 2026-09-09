import { PackageSearch } from "lucide-react";

export function EmptyState({ title = "Nenhum registro encontrado", description = "Ajuste os filtros ou cadastre um novo registro." }) {
  return (
    <div className="empty-state">
      <PackageSearch size={34} aria-hidden />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
