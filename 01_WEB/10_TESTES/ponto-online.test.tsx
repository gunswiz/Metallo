// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeuPontoOnline } from "@/app/colaborador/[[...screen]]/meu-ponto-online";
import { onlinePointRequest, pointReceipt } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import { acquireEventLocation } from "@/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento";
import { referenceTime, pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
vi.mock("@/05_ACESSO_A_DADOS/Ponto/ponto-online", async original => ({ ...await original<typeof import("@/05_ACESSO_A_DADOS/Ponto/ponto-online")>(), onlinePointRequest: vi.fn() }));
const request = vi.mocked(onlinePointRequest), getToken = vi.fn(async () => "JWT-SINTETICO"), gps = vi.fn();
const event = { event_id: "00000000-0000-4000-8000-000000000001", synthetic_reference: "LAB-4A-1", marking_at: "2026-10-01T12:00:00.000Z", recorded_at: "2026-10-01T12:00:08.000Z", timezone: "America/Fortaleza" as const, collector: "BROWSER" as const, online: true as const, location_status: "DENIED" as const, accuracy_meters: null };
const renderPoint = () => render(<MeuPontoOnline getToken={getToken} employeeId="joao" name="João Sintético"/>);
beforeEach(() => {
  request.mockReset(); getToken.mockReset(); getToken.mockResolvedValue("JWT-SINTETICO"); gps.mockReset();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_name, _options, run) => run({ name: "lock" })) } });
  gps.mockImplementation((_ok, fail) => fail({ code: 1 }));
  request.mockImplementation(async path => path === "/clock" ? { server_at: event.marking_at } : path === "/events" ? { events: [] } : { idempotency_key: "key" });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("não solicita GPS ao montar, carregar horário ou consultar histórico", async () => { renderPoint(); await waitFor(() => expect(request).toHaveBeenCalled()); expect(gps).not.toHaveBeenCalled(); expect(screen.getByText(/não realiza rastreamento contínuo/)).toBeInTheDocument(); });
it("GPS negado mantém operação e só mostra sucesso após commit confirmado", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation(async (path, _token, init) => path === "/events" && init?.method === "POST" ? new Promise(resolve => { finish = resolve; }) : path === "/events" ? { events: [] } : { server_at: event.marking_at });
  renderPoint(); const button = screen.getByRole("button", { name: "Registrar ponto" }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(finish).toBeTypeOf("function")); expect(button).toBeDisabled(); expect(gps).toHaveBeenCalledTimes(1); expect(screen.queryByRole("heading", { name: "Ponto registrado" })).not.toBeInTheDocument();
  finish({ event }); expect(await screen.findByRole("heading", { name: "Ponto registrado" })).toBeInTheDocument(); expect(screen.getAllByText(/Permissão de localização negada/).length).toBeGreaterThan(0);
  expect(request.mock.calls.filter(([path,,init]) => path === "/events" && init?.method === "POST")).toHaveLength(1);
});
it("resposta perdida consulta mesma chave e não repete GPS", async () => {
  request.mockImplementation(async (path,_token,init) => path.startsWith("/intent/") ? { event } : path === "/events" && init?.method === "POST" ? Promise.reject(Error("resposta perdida")) : path === "/events" ? { events: [] } : { server_at: event.marking_at });
  renderPoint(); fireEvent.click(screen.getByRole("button", { name: "Registrar ponto" })); expect(await screen.findByRole("heading", { name: "Ponto registrado" })).toBeInTheDocument(); expect(gps).toHaveBeenCalledTimes(1);
  const post = request.mock.calls.find(([path,,init]) => path === "/events" && init?.method === "POST"); const key = JSON.parse(String(post?.[2]?.body)).idempotency_key;
  expect(request.mock.calls.some(([path]) => path === `/intent/${key}`)).toBe(true);
});
it("falha sem confirmação não finge sucesso nem cria fila offline", async () => {
  Object.defineProperty(navigator,"onLine",{configurable:true,value:false}); request.mockRejectedValue(Error("offline"));
  renderPoint(); fireEvent.click(screen.getByRole("button",{name:"Registrar ponto"})); expect(await screen.findByText(/Sem conexão.*não existe fila offline/)).toBeInTheDocument(); expect(gps).not.toHaveBeenCalled(); expect(screen.queryByRole("heading",{name:"Ponto registrado"})).not.toBeInTheDocument(); expect(request.mock.calls.filter(([, ,init])=>init?.method==="POST")).toHaveLength(0);
});
it("retry mantém mesma intenção e localização após servidor indisponível", async () => {
  request.mockImplementation(async(path,_token,init)=>path.startsWith("/intent/")||path==="/events"&&init?.method==="POST"?Promise.reject(Error("indisponível")):path==="/events"?{events:[]}:{server_at:event.marking_at});
  renderPoint(); fireEvent.click(screen.getByRole("button",{name:"Registrar ponto"})); const retry = await screen.findByRole("button",{name:"Verificar / reenviar a mesma intenção"}); fireEvent.click(retry);
  await waitFor(()=>expect(request.mock.calls.filter(([path,,init])=>path==="/events"&&init?.method==="POST")).toHaveLength(2));
  const posts=request.mock.calls.filter(([path,,init])=>path==="/events"&&init?.method==="POST"); expect(posts[0][2]?.body).toBe(posts[1][2]?.body); expect(gps).toHaveBeenCalledTimes(1);
});
it("lock ocupado em outra aba não inicia GPS nem POST", async()=>{
  Object.defineProperty(navigator,"locks",{configurable:true,value:{request:vi.fn(async(_a,_b,run)=>run(null))}});
  renderPoint();fireEvent.click(screen.getByRole("button",{name:"Registrar ponto"}));expect(await screen.findByText(/outra aba/)).toBeInTheDocument();expect(gps).not.toHaveBeenCalled();expect(request.mock.calls.filter(([, ,init])=>init?.method==="POST")).toHaveLength(0);
});
it("troca de conta desmonta operação e ignora resposta antiga", async()=>{
  let finish!:(value:unknown)=>void;
  request.mockImplementation(async(path,_token,init)=>path==="/events"&&init?.method==="POST"?new Promise(resolve=>{finish=resolve;}):path==="/events"?{events:[]}:{server_at:event.marking_at});
  const view=renderPoint();fireEvent.click(screen.getByRole("button",{name:"Registrar ponto"}));await waitFor(()=>expect(finish).toBeTypeOf("function"));
  view.rerender(<MeuPontoOnline key="maria" getToken={getToken} employeeId="maria" name="Maria Sintética"/>);finish({event});await waitFor(()=>expect(screen.getByText("Olá, Maria.")).toBeInTheDocument());expect(screen.queryByRole("heading",{name:"Ponto registrado"})).not.toBeInTheDocument();
});
it("revogação remove histórico e recibo pessoal",async()=>{
  request.mockImplementation(async(path,_token,init)=>init?.method==="POST"?Promise.reject(Error("CONTEXTO_INATIVO")):path==="/events"?{events:[event]}:{server_at:event.marking_at});
  renderPoint();await screen.findByText(/01\/10\/2026/);fireEvent.click(screen.getByRole("button",{name:"Registrar ponto"}));expect(await screen.findByText(/Acesso negado/)).toBeInTheDocument();expect(screen.queryByText(/01\/10\/2026/)).not.toBeInTheDocument();
});
it("leitura iniciada antes da marcação não apaga o histórico recém-confirmado",async()=>{
  let oldRead!:(v:unknown)=>void;let reads=0;
  request.mockImplementation(async(path,_token,init)=>path==="/events"&&init?.method==="POST"?{event}:path==="/events"?++reads===1?new Promise(resolve=>{oldRead=resolve;}):{events:[event]}:{server_at:event.marking_at});
  renderPoint();await waitFor(()=>expect(oldRead).toBeTypeOf("function"));fireEvent.click(screen.getByRole("button",{name:"Registrar ponto"}));await screen.findByRole("heading",{name:"Ponto registrado"});oldRead({events:[]});await waitFor(()=>expect(screen.queryByText("Nenhuma marcação confirmada nesta conta.")).not.toBeInTheDocument());
});
it("DTO rejeita dados operacionais extras e falsa hora",()=>{expect(pointReceipt.parse(event)).toEqual(event);expect(()=>pointReceipt.parse({...event,employee_id:"maria"})).toThrow();expect(()=>pointReceipt.parse({...event,marking_at:"ontem"})).toThrow();});
it.each([1,2,3])("erro GPS %i encerra aquisição sem tracking",async code=>{const read=vi.fn((_ok,fail,options?:unknown)=>{expect(options).toEqual({enableHighAccuracy:false,maximumAge:0,timeout:8000});fail({code});});const geo={getCurrentPosition:read} as unknown as Geolocation;expect((await acquireEventLocation(geo,new AbortController().signal)).status).toBe(code===1?"DENIED":code===3?"TIMEOUT":"UNAVAILABLE");expect(read).toHaveBeenCalledTimes(1);});
it("GPS disponível e precisão retornada são transmitidos sem fabricar dados",async()=>{const geo={getCurrentPosition:(ok:(v:unknown)=>void)=>ok({coords:{latitude:-3.7,longitude:-38.5,accuracy:5},timestamp:Date.parse(event.marking_at)})} as unknown as Geolocation;expect(await acquireEventLocation(geo,new AbortController().signal)).toMatchObject({status:"AVAILABLE",accuracy_meters:5});});
it("timestamp GPS fora do intervalo de Date vira UNKNOWN",async()=>{const geo={getCurrentPosition:(ok:(v:unknown)=>void)=>ok({coords:{latitude:0,longitude:0,accuracy:5},timestamp:1e20})} as unknown as Geolocation;expect((await acquireEventLocation(geo,new AbortController().signal)).status).toBe("UNKNOWN");});
it("GPS sem resposta encerra aquisição pelo timeout próprio",async()=>{vi.useFakeTimers();try{const geo={getCurrentPosition:vi.fn()} as unknown as Geolocation;const operation=acquireEventLocation(geo,new AbortController().signal);await vi.advanceTimersByTimeAsync(8500);expect((await operation).status).toBe("TIMEOUT");}finally{vi.useRealTimers();}});
it("cancelamento ignora callback GPS tardio",async()=>{let finish!:(v:unknown)=>void;const geo={getCurrentPosition:(ok:(v:unknown)=>void)=>{finish=ok;}} as unknown as Geolocation;const abort=new AbortController();const operation=acquireEventLocation(geo,abort.signal);abort.abort();finish({coords:{latitude:0,longitude:0,accuracy:5},timestamp:Date.parse(event.marking_at)});expect((await operation).status).toBe("UNKNOWN");});
it("API ausente registra indisponibilidade",async()=>expect((await acquireEventLocation(undefined,new AbortController().signal)).status).toBe("UNAVAILABLE"));
it.each(["2020-01-01","2030-01-01"])("relógio cliente %s não redefine hora de referência",date=>{vi.spyOn(Date,"now").mockReturnValue(Date.parse(date));expect(pointTime(referenceTime("2026-10-01T12:00:00Z",100,1100)!)).toBe("09:00:01");});
it("virada de minuto é calculada pelo tempo monotônico",()=>expect(pointTime(referenceTime("2026-10-01T12:00:59Z",0,1000)!)).toBe("09:01:00"));
it("virada de dia e timezone Fortaleza são preservados",()=>{const at=referenceTime("2026-10-02T02:59:59Z",0,1000)!;expect(pointDate(at)).toBe("02/10/2026");expect(pointTime(at)).toBe("00:00:00");});
it("referência obsoleta ou tempo monotônico negativo fica indisponível",()=>{expect(referenceTime(event.marking_at,0,60001)).toBeNull();expect(referenceTime(event.marking_at,100,0)).toBeNull();});
