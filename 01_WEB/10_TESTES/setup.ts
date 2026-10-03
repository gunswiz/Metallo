import "@testing-library/jest-dom/vitest";

// JSDOM não implementa o dialog nativo. Somente apresentação; foco/teclado
// continuam exercitados pelos testes e o modal real é conferido no Edge.
if (typeof HTMLDialogElement !== "undefined") {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function () { this.removeAttribute("open"); } });
}
