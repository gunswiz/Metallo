import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";

describe("StatusBadge", () => {
  it("traduz e sinaliza status de manutenção", () => {
    render(<StatusBadge value="maintenance" />);
    expect(screen.getByText("Manutenção")).toHaveClass("warn");
  });
});
