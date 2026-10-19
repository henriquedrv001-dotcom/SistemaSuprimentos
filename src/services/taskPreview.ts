/** Interactive examples only: never persisted and never execute DL operations. */
export type PreviewRole = "aprendiz" | "estoque" | "compradora";
export type PreviewTaskState = "todo" | "doing" | "review" | "done";
export const previewRoles: Record<PreviewRole, string> = {
  aprendiz: "Jovem aprendiz",
  estoque: "Responsável pelo estoque",
  compradora: "Compradora",
};
export const previewStates: Record<PreviewTaskState, string> = {
  todo: "A executar",
  doing: "Em andamento",
  review: "Em análise",
  done: "Concluídas",
};
export const previewSteps: {
  title: string;
  role: PreviewRole;
  instruction: string;
  action: string;
}[] = [
  {
    title: "Gerar justificativa",
    role: "estoque",
    instruction:
      "Preparar e conferir a justificativa da aquisição antes da requisição.",
    action: "Concluir justificativa",
  },
  {
    title: "Gerar requisição",
    role: "aprendiz",
    instruction:
      "Consultar os materiais, gerar a requisição no MXM e registrar seu número e data.",
    action: "Enviar para análise",
  },
  {
    title: "Analisar requisição",
    role: "estoque",
    instruction:
      "Conferir a requisição no MXM. Aprovar o encaminhamento ou devolver com uma observação.",
    action: "Aprovar e enviar para compra",
  },
  {
    title: "Registrar pedido",
    role: "compradora",
    instruction:
      "Anexar o pedido emitido no MXM e registrar o fechamento do processo de compra.",
    action: "Registrar pedido",
  },
  {
    title: "Definir fornecedores",
    role: "aprendiz",
    instruction:
      "Conferir o pedido e preencher fornecedores, números MXM e valores de cada item.",
    action: "Enviar para aprovação",
  },
  {
    title: "Aprovar contratação",
    role: "estoque",
    instruction:
      "Conferir os dados finais e aprovar a conclusão da DL para disponibilizar seus itens no Controle.",
    action: "Aprovar e concluir",
  },
];
export type PreviewFlow = {
  id: string;
  reference: string;
  object: string;
  stage: number;
  state: PreviewTaskState;
  priority: "Alta" | "Normal";
  returnNote?: string;
};
export function initialPreviewFlows(): PreviewFlow[] {
  return [
    {
      id: "demo-1",
      reference: "EXEMPLO 01",
      object: "MATERIAIS ADMINISTRATIVOS",
      stage: 1,
      state: "todo",
      priority: "Alta",
    },
    {
      id: "demo-2",
      reference: "EXEMPLO 02",
      object: "ITENS DE BOMBONIERE",
      stage: 3,
      state: "doing",
      priority: "Normal",
    },
    {
      id: "demo-3",
      reference: "EXEMPLO 03",
      object: "GÊNEROS CONGELADOS",
      stage: 5,
      state: "review",
      priority: "Alta",
    },
    {
      id: "demo-4",
      reference: "EXEMPLO 04",
      object: "MATERIAIS DE INFORMÁTICA",
      stage: 5,
      state: "done",
      priority: "Normal",
    },
    {
      id: "demo-5",
      reference: "EXEMPLO 05",
      object: "HORTIFRUTIGRANJEIROS",
      stage: 4,
      state: "todo",
      priority: "Normal",
    },
  ];
}
export function startPreviewFlow(flow: PreviewFlow): PreviewFlow {
  if (flow.state !== "todo") return flow;
  return { ...flow, state: "doing" };
}
export function advancePreviewFlow(flow: PreviewFlow): PreviewFlow {
  if (flow.state === "done") return flow;
  if (flow.state !== "doing" && flow.state !== "review")
    throw new Error("Inicie a simulação da tarefa antes de encaminhar.");
  if (flow.stage === previewSteps.length - 1)
    return { ...flow, state: "done", returnNote: undefined };
  const stage = flow.stage + 1;
  return {
    ...flow,
    stage,
    state: stage === 2 || stage === 5 ? "review" : "todo",
    returnNote: undefined,
  };
}
export function returnPreviewFlow(
  flow: PreviewFlow,
  reason: string,
): PreviewFlow {
  if (![2, 5].includes(flow.stage) || flow.state === "done")
    throw new Error("A devolução ocorre nas etapas de análise ou aprovação.");
  if (!reason.trim())
    throw new Error("Informe uma observação para a correção.");
  return {
    ...flow,
    stage: flow.stage - 1,
    state: "todo",
    returnNote: reason.trim(),
  };
}
