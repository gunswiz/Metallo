// Candidato exclusivamente local; transporte normal, sem injecao de falha.
import { createRevocationHandler } from "./handler.ts";
Deno.serve(createRevocationHandler());
