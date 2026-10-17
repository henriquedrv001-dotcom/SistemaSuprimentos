import type { DLContract, DLContractAward, DLPlan } from "../types/dl";
export const emptyDLContract = (): DLContract => ({
  awards: [],
  notAwarded: [],
  signedOn: "",
  validFrom: "",
  validUntil: "",
  notes: "",
});
const dateOK = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export function awardTotal(award: DLContractAward) {
  if (award.quantityMilli === null || award.unitPriceCents === null)
    return null;
  const amount =
    (BigInt(award.quantityMilli) * BigInt(award.unitPriceCents) + 500n) / 1000n;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Valor contratado acima do limite permitido.");
  return Number(amount);
}
export function contractTotal(contract: DLContract) {
  let amount = 0n;
  let incomplete = 0;
  for (const award of contract.awards) {
    const subtotal = awardTotal(award);
    if (subtotal === null) incomplete++;
    else amount += BigInt(subtotal);
  }
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Total contratado acima do limite permitido.");
  return { totalCents: Number(amount), incomplete };
}
export function contractedQuantity(contract: DLContract, lineId: string) {
  const total = contract.awards
    .filter((award) => award.lineId === lineId)
    .reduce((sum, award) => sum + BigInt(award.quantityMilli ?? 0), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Quantidade contratada acima do limite permitido.");
  return Number(total);
}
export function validateDLContract(
  plan: DLPlan,
  complete = !!plan.contract?.release,
) {
  if (
    complete &&
    plan.requestWorkflow &&
    (!plan.requestReview ||
      plan.requestReview.mxmNumber !== plan.request.mxmNumber.trim() ||
      plan.requestReview.requestDate !== plan.request.date)
  )
    throw new Error(
      "Confirme a análise da requisição gerada antes de concluir a contratação.",
    );
  const contract = plan.contract;
  if (!contract) {
    if (complete || plan.stage === "Concluído")
      throw new Error(
        "Informe os resultados da contratação antes de concluir a DL.",
      );
    return;
  }
  if (!Array.isArray(contract.awards) || !Array.isArray(contract.notAwarded))
    throw new Error("Dados de contratação inválidos.");
  for (const field of ["signedOn", "validFrom", "validUntil", "notes"] as const)
    if (typeof contract[field] !== "string")
      throw new Error("Informações da contratação inválidas.");
  const lineIds = new Set(plan.lines.map((line) => line.id));
  if (
    new Set(contract.awards.map((award) => award.lineId)).size !==
      contract.awards.length ||
    new Set(contract.awards.map((award) => award.id)).size !==
      contract.awards.length ||
    new Set(contract.notAwarded.map((result) => result.lineId)).size !==
      contract.notAwarded.length
  )
    throw new Error(
      "Cada item deve ter uma única contratação e um único fornecedor.",
    );
  for (const award of contract.awards) {
    if (!award.id || !lineIds.has(award.lineId))
      throw new Error(
        "A contratação referencia um material ausente do planejamento. Revise o resultado antes de retirar materiais.",
      );
    for (const field of [
      "supplier",
      "supplierReference",
      "mxmOrder",
      "orderDate",
    ] as const)
      if (typeof award[field] !== "string")
        throw new Error("Informações de fornecedor/pedido inválidas.");
    if (
      award.quantityMilli !== null &&
      (!Number.isSafeInteger(award.quantityMilli) || award.quantityMilli <= 0)
    )
      throw new Error("A quantidade contratada precisa ser maior que zero.");
    if (
      award.unitPriceCents !== null &&
      (!Number.isSafeInteger(award.unitPriceCents) || award.unitPriceCents < 0)
    )
      throw new Error("Informe um preço final válido, sem valores negativos.");
    if (award.orderDate && !dateOK(award.orderDate))
      throw new Error("Data do pedido MXM inválida.");
    if (
      complete &&
      (!award.supplier.trim() ||
        !award.supplierReference.trim() ||
        !award.mxmOrder.trim() ||
        !dateOK(award.orderDate) ||
        award.quantityMilli === null ||
        award.unitPriceCents === null)
    )
      throw new Error(
        "Complete fornecedor, identificação, pedido MXM, data, quantidade e preço final de todas as contratações.",
      );
  }
  const suppliersByOrder = new Map<string, string>();
  for (const award of contract.awards) {
    const order = award.mxmOrder.trim().toLocaleUpperCase("pt-BR");
    const supplier = award.supplierReference.trim().toLocaleUpperCase("pt-BR");
    if (order && supplier) {
      if (
        suppliersByOrder.has(order) &&
        suppliersByOrder.get(order) !== supplier
      )
        throw new Error(
          "O mesmo pedido de compra MXM não pode identificar fornecedores diferentes na mesma DL.",
        );
      suppliersByOrder.set(order, supplier);
    }
  }
  for (const result of contract.notAwarded) {
    if (
      !lineIds.has(result.lineId) ||
      typeof result.reason !== "string" ||
      contract.awards.some((award) => award.lineId === result.lineId)
    )
      throw new Error(
        "O mesmo material não pode estar contratado e não contratado. Revise seus resultados.",
      );
    if (complete && !result.reason.trim())
      throw new Error("Informe o motivo dos materiais não contratados.");
  }
  for (const line of plan.lines) contractedQuantity(contract, line.id);
  for (const key of ["signedOn", "validFrom", "validUntil"] as const)
    if (contract[key] && !dateOK(contract[key]))
      throw new Error("Há uma data inválida na contratação.");
  if (
    contract.validFrom &&
    contract.validUntil &&
    contract.validUntil < contract.validFrom
  )
    throw new Error("O fim da vigência não pode ser anterior ao início.");
  if (!!contract.validFrom !== !!contract.validUntil)
    throw new Error(
      "Preencha início e fim da vigência, ou deixe ambos em branco quando não se aplicar.",
    );
  contractTotal(contract);
  if (complete) {
    if (!contract.awards.length)
      throw new Error(
        "Não há contratação para disponibilizar no Controle. Para processo sem êxito, use Não contratado.",
      );
    if (
      !plan.lines.length ||
      plan.lines.some(
        (line) =>
          !contract.awards.some((award) => award.lineId === line.id) &&
          !contract.notAwarded.some((result) => result.lineId === line.id),
      )
    )
      throw new Error(
        "Registre o resultado de todos os materiais: contratado ou não contratado com motivo.",
      );
    if (
      !plan.request.mxmNumber.trim() ||
      !dateOK(plan.request.date) ||
      !dateOK(contract.signedOn)
    )
      throw new Error(
        "Informe a requisição MXM com data e a data da contratação.",
      );
  }
  if (contract.release) {
    if (
      plan.stage !== "Concluído" ||
      !contract.release.reference.trim() ||
      !dateOK(contract.release.confirmedOn) ||
      !contract.release.actor.trim() ||
      !Number.isFinite(Date.parse(contract.release.timestamp))
    )
      throw new Error("A conclusão da contratação está inconsistente.");
  } else if (plan.stage === "Concluído")
    throw new Error(
      "Confirme a conclusão da DL antes de disponibilizar os saldos.",
    );
}
export function contractOrigins(plan: DLPlan) {
  if (!plan.contract?.release || plan.stage !== "Concluído") return [];
  validateDLContract(plan, true);
  return plan.contract.awards.map((award) => ({
    id: award.id,
    planId: plan.id,
    lineId: award.lineId,
    itemId: plan.lines.find((line) => line.id === award.lineId)!.itemId,
    unit: plan.lines.find((line) => line.id === award.lineId)!.unit,
    supplier: award.supplier,
    supplierReference: award.supplierReference,
    mxmOrder: award.mxmOrder,
    quantityMilli: award.quantityMilli!,
    unitPriceCents: award.unitPriceCents!,
    receivedMilli: 0,
    reservedMilli: 0,
    remainingMilli: award.quantityMilli!,
    availableMilli: award.quantityMilli!,
  }));
}
export function contractStatus(plan: DLPlan, today: string) {
  if (!plan.contract?.release) return "Não concluída";
  if (plan.contract.validFrom && today < plan.contract.validFrom)
    return "Vigência futura";
  if (plan.contract.validUntil && today > plan.contract.validUntil)
    return "Vigência encerrada";
  if (plan.contract.validUntil) {
    const days = Math.round(
      (Date.parse(plan.contract.validUntil + "T12:00:00Z") -
        Date.parse(today + "T12:00:00Z")) /
        86400000,
    );
    if (days <= 30) return "Vence em até 30 dias";
  }
  return "Ativa";
}

export function releaseDLPlan(
  plan: DLPlan,
  checked: boolean,
  confirmation: string,
): DLPlan {
  if (plan.contract?.release)
    throw new Error(
      "Esta DL já foi concluída. Nenhum saldo adicional foi criado.",
    );
  if (
    [
      "Rascunho",
      "Em planejamento",
      "Gerar requisição",
      "Analisar requisição gerada",
      "Cancelado",
      "Suspenso",
      "Não contratado",
    ].includes(plan.stage)
  )
    throw new Error(
      "Conclua o planejamento e revise a tramitação antes de liberar a contratação.",
    );
  if (!checked || confirmation !== "CONCLUIR")
    throw new Error(
      "Confirme os pedidos de compra MXM emitidos e digite CONCLUIR para disponibilizar no Controle.",
    );
  validateDLContract(plan, true);
  const contract = plan.contract!;
  const saved: DLPlan = {
    ...plan,
    stage: "Concluído",
    contract: {
      ...contract,
      release: {
        timestamp: new Date().toISOString(),
        actor: "Sessão local · sem autenticação",
        reference: `Pedido(s) de compra MXM emitido(s): ${[...new Set(contract.awards.map((award) => award.mxmOrder.trim()))].join(", ")}. Dados finais conferidos.`,
        confirmedOn: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      },
    },
  };
  return saved;
}
