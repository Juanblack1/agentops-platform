import { RagService } from "../rag/ragService";
import { InMemoryStore } from "../repositories/inMemoryStore";
import { TicketService } from "./ticketService";

export async function seedDemoData(store: InMemoryStore, rag: RagService, tickets: TicketService) {
  if (store.listDocuments().length > 0) {
    return;
  }

  await rag.ingest({
    title: "Politica de Atendimento Corporativo",
    classification: "internal",
    tags: ["atendimento", "sla", "cliente"],
    content:
      "Tickets de baixa severidade devem receber primeira resposta em ate 4 horas uteis. Incidentes criticos devem ser classificados como P1, comunicados ao gestor da plataforma e atualizados a cada 30 minutos ate contencao. Respostas externas devem citar apenas informacoes aprovadas."
  });

  await rag.ingest({
    title: "Runbook de Indisponibilidade",
    classification: "confidential",
    tags: ["ti", "incidente", "runbook"],
    content:
      "Quando houver indisponibilidade, valide saude do gateway, filas, banco de dados e dependencias externas. Se o erro envolver autenticacao ou tokens, nunca exponha credenciais no ticket. Registre hora de inicio, impacto, sistemas afetados e acao de contencao."
  });

  await rag.ingest({
    title: "Norma de Governanca de IA",
    classification: "restricted",
    tags: ["ia", "governanca", "compliance"],
    content:
      "Toda resposta gerada por IA que envolva dados pessoais, contratos, privacidade, seguranca ou credenciais deve passar por aprovacao humana. Promessas absolutas, garantias de resultado e diagnosticos sem evidencia devem ser evitados."
  });

  await tickets.createTicket({
    subject: "Portal de clientes fora do ar",
    customer: "ACME Corp",
    description: "Clientes relatam indisponibilidade no portal e timeout no login desde 09:20."
  });
}
