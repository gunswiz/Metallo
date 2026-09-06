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
  return (
    <footer className="pagination">
      <span>{count} registro{count === 1 ? "" : "s"} · página {Math.min(page, pages)} de {pages}</span>
      <div>
        <Link href={href(Math.max(1, page - 1), q, extra)} aria-disabled={page <= 1}>Anterior</Link>
        <Link href={href(Math.min(pages, page + 1), q, extra)} aria-disabled={page >= pages}>Próxima</Link>
      </div>
    </footer>
  );
}
