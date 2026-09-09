import { describe, expect, it } from "vitest";
import { resolveApplicationOrigin } from "@/03_FUNCOES_E_LOGICA/Autenticacao/application-origin";

describe("origem pública da aplicação", () => {
  it("usa a origem HTTPS da requisição no ambiente publicado", () => {
    expect(resolveApplicationOrigin({
      origin: "https://metallo-web.example.workers.dev",
      forwardedHost: "metallo-web.example.workers.dev",
      forwardedProto: "https",
      host: "metallo-web.example.workers.dev",
    })).toBe("https://metallo-web.example.workers.dev");
  });

  it("reconstrói a origem a partir dos cabeçalhos do proxy", () => {
    expect(resolveApplicationOrigin({
      origin: null,
      forwardedHost: "metallo.example.com, proxy.internal",
      forwardedProto: "https, http",
      host: "proxy.internal",
    })).toBe("https://metallo.example.com");
  });

  it("mantém o desenvolvimento local em HTTP", () => {
    expect(resolveApplicationOrigin({
      origin: null,
      forwardedHost: null,
      forwardedProto: null,
      host: "localhost:3000",
    })).toBe("http://localhost:3000");
  });

  it("ignora protocolos que não sejam HTTP", () => {
    expect(resolveApplicationOrigin({
      origin: "javascript:alert(1)",
      forwardedHost: null,
      forwardedProto: null,
      host: null,
    })).toBe("http://localhost:3000");
  });
});
