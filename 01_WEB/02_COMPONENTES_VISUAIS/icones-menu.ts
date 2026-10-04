// Ícones do menu da Gestão (módulo comum: usado por telas do servidor e pelo menu no navegador).
import {
  BookOpen, Boxes, Building2, ChartNoAxesCombined, ClipboardList, Clock3, FileText, Gauge, HardHat, Handshake,
  History, Inbox, Megaphone, PackageOpen, CirclePlus, Settings, ShoppingCart, Toolbox, Truck, UserRound,
  UserRoundCog, Users, Warehouse, Wrench, type LucideIcon,
} from "lucide-react";

export const ICONES: Record<string, LucideIcon> = {
  inicio: Gauge, lancar: CirclePlus, estoque: Warehouse, materiais: PackageOpen, epis: HardHat, ferramentas: Toolbox,
  equipamentos: Wrench, historico: History, compras: ShoppingCart, caixa: Inbox, locacoes: Truck, funcionarios: UserRound,
  apoio: Handshake, equipes: Users, comunicados: Megaphone, ponto: Clock3, obras: Building2, consumo: ChartNoAxesCombined,
  relatorios: FileText, usuarios: UserRoundCog, configuracoes: Settings, conta: UserRoundCog, ajuda: BookOpen, outros: Boxes, lista: ClipboardList,
};
