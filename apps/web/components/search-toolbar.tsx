import { Search } from "lucide-react";

export function SearchToolbar({ placeholder, q, children }: { placeholder: string; q: string; children?: React.ReactNode }) {
  return (
    <form className="toolbar">
      <label className="search-box">
        <Search size={16} aria-hidden />
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {children}
      <button className="button secondary" type="submit">Pesquisar</button>
    </form>
  );
}
