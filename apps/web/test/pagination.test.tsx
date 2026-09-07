import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/components/pagination";

describe("Pagination", () => {
  it("remove do teclado as ações indisponíveis na única página", () => {
    render(<Pagination page={1} pageSize={20} count={3} q="" />);

    expect(screen.queryByRole("link", { name: "Anterior" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Próxima" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Anterior|Próxima/)).toHaveLength(2);
  });

  it("mantém somente as páginas válidas como links", () => {
    render(<Pagination page={2} pageSize={10} count={35} q="eletrodo" />);

    expect(screen.getByRole("link", { name: "Ir para a página 1" })).toHaveAttribute("href", "?q=eletrodo&page=1");
    expect(screen.getByRole("link", { name: "Ir para a página 3" })).toHaveAttribute("href", "?q=eletrodo&page=3");
  });
});
