import Link from "next/link";

function href(page: number, q: string, extra: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (q) params.set("q", q);
  params.set("page", String(page));
  return `?${params}`;
}

export function Pagination({ page, pageSize, count, q, extra = {} }: { page: number; pageSize: number; count: number; q: string; extra?: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const previousDisabled = page <= 1;
  const nextDisabled = page >= pages;
  return (
    <footer className="pagination" aria-label="Paginação">
      <span>{count} registro{count === 1 ? "" : "s"} · página {Math.min(page, pages)} de {pages}</span>
      <div>
        {previousDisabled
          ? <span className="pagination-disabled" aria-disabled="true">Anterior</span>
          : <Link href={href(page - 1, q, extra)} aria-label={`Ir para a página ${page - 1}`}>Anterior</Link>}
        {nextDisabled
          ? <span className="pagination-disabled" aria-disabled="true">Próxima</span>
          : <Link href={href(page + 1, q, extra)} aria-label={`Ir para a página ${page + 1}`}>Próxima</Link>}
      </div>
    </footer>
  );
}
