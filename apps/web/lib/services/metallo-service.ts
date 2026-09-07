import { cache } from "react";
import { toAppError } from "@/lib/errors/app-error";
import { MetalloRepository } from "@/lib/repositories/metallo-repository";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export const getMetalloService = cache(async () => {
  await requireProfile();
  const client = await createClient();
  const repository = new MetalloRepository(client);

  const safe = async <T>(operation: () => Promise<T>, message: string) => {
    try {
      return await operation();
    } catch (error) {
      throw toAppError(error, message);
    }
  };

  return {
    dashboard: (includeEpi: boolean) => safe(() => repository.dashboard(includeEpi), "Não foi possível carregar o dashboard."),
    listMaterials: (input: { page: number; pageSize: number; q: string }) => safe(() => repository.listMaterials(input), "Não foi possível carregar os materiais."),
    getMaterial: (id: string) => safe(() => repository.getMaterial(id), "Material não encontrado."),
    listAssets: (input: { page: number; pageSize: number; q: string; ownership?: string }) => safe(() => repository.listAssets(input), "Não foi possível carregar os equipamentos."),
    getAsset: (id: string) => safe(() => repository.getAsset(id), "Equipamento não encontrado."),
    listEpiItems: (input: { page: number; pageSize: number; q: string }, kind?: string) => safe(() => repository.listEpiItems(input, kind), "Não foi possível carregar os itens de proteção."),
    getEpiItem: (id: string) => safe(() => repository.getEpiItem(id), "Item da COSEM não encontrado."),
    listTeams: () => safe(() => repository.listTeams(), "Não foi possível carregar as equipes."),
    listProfessions: () => safe(() => repository.listProfessions(), "Não foi possível carregar as profissões."),
    getTeam: (id: string) => safe(() => repository.getTeam(id), "Equipe não encontrada."),
    listEmployees: (input: { page: number; pageSize: number; q: string }) => safe(() => repository.listEmployees(input), "Não foi possível carregar os funcionários."),
    getEmployee: (id: string) => safe(() => repository.getEmployee(id), "Funcionário não encontrado."),
    listMovements: (input: { page: number; pageSize: number; q: string }) => safe(() => repository.listMovements(input), "Não foi possível carregar as movimentações."),
    consumptionRows: (filter: { from: string; to: string; teamId?: string; itemId?: string }) => safe(() => repository.consumptionRows(filter), "Não foi possível carregar o consumo."),
    reportData: (filter: { from: string; to: string; teamId?: string; itemId?: string }, includeEpi: boolean) => safe(() => repository.reportData(filter, includeEpi), "Não foi possível carregar os relatórios."),
    epiReportData: (filter: { from: string; to: string; teamId?: string; employeeId?: string }) => safe(() => repository.epiReportData(filter), "Não foi possível gerar o relatório de EPI."),
    listProfiles: () => safe(() => repository.listProfiles(), "Não foi possível carregar os usuários."),
  };
});
