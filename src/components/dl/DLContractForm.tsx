import type { DLContract, DLContractAward, DLPlan } from "../../types/dl";
import type { Item } from "../../types";
import { emptyDLContract, awardTotal } from "../../services/dlContract";
import {
  decimalInput,
  formatMoney,
  lineSubtotal,
  parseScaledInput,
} from "../../services/dlPlanning";
export type AwardInput = Omit<
  DLContractAward,
  "quantityMilli" | "unitPriceCents"
> & { quantity: string; price: string };
export type ContractInput = Omit<DLContract, "awards"> & {
  awards: AwardInput[];
};
export function contractInput(contract?: DLContract): ContractInput {
  const value = contract ?? emptyDLContract();
  return {
    ...value,
    awards: value.awards.map(({ quantityMilli, unitPriceCents, ...award }) => ({
      ...award,
      quantity: decimalInput(quantityMilli, 3),
      price: decimalInput(unitPriceCents, 2),
    })),
  };
}
export function materializeContract(value: ContractInput): DLContract {
  return {
    ...value,
    awards: value.awards.map(({ quantity, price, ...award }) => ({
      ...award,
      quantityMilli: parseScaledInput(quantity, 3, "Quantidade contratada"),
      unitPriceCents: parseScaledInput(price, 2, "Preço final"),
    })),
  };
}
export default function DLContractForm({
  plan,
  items,
  value,
  onChange,
  readOnly,
}: {
  plan: DLPlan;
  items: Item[];
  value: ContractInput;
  onChange: (value: ContractInput) => void;
  readOnly: boolean;
}) {
  function patchAward(id: string, patch: Partial<AwardInput>) {
    onChange({
      ...value,
      awards: value.awards.map((award) =>
        award.id === id ? { ...award, ...patch } : award,
      ),
    });
  }
  let finalTotal = 0;
  let valid = true;
  try {
    for (const award of materializeContract(value).awards) {
      const amount = awardTotal(award);
      if (amount === null) valid = false;
      else finalTotal += amount;
    }
    if (!Number.isSafeInteger(finalTotal)) valid = false;
  } catch {
    valid = false;
  }
  const estimated = plan.lines.reduce(
    (total, line) => total + (lineSubtotal(line) ?? 0),
    0,
  );
  const completeResults = plan.lines.every(
    (line) =>
      value.awards.some((a) => a.lineId === line.id) ||
      value.notAwarded.some((a) => a.lineId === line.id),
  );
  const difference = finalTotal - estimated;
  return (
    <>
      <div className="dl-contract-summary">
        <div>
          <span>Orçamento previsto</span>
          <strong>{formatMoney(estimated)}</strong>
        </div>
        <div>
          <span>
            Contratação {valid && completeResults ? "informada" : "parcial"}
          </span>
          <strong>
            {valid ? formatMoney(finalTotal) : "Revise os valores"}
          </strong>
        </div>
        <div>
          <span>
            Diferença{" "}
            {valid && completeResults ? "sobre o previsto" : "parcial"}
          </span>
          <strong>
            {valid
              ? `${formatMoney(difference)}${estimated ? ` (${((difference / estimated) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : ""}`
              : "—"}
          </strong>
        </div>
      </div>
      <p className="muted">
        Um fornecedor por item. Quantidades e preços finais não alteram o
        orçamento previsto. Preencha os resultados e salve antes de concluir a
        DL.
      </p>
      <fieldset disabled={readOnly} className="dl-contract-fields">
        <div className="form-grid">
          {(
            [
              ["signedOn", "Data da contratação"],
              ["validFrom", "Início da vigência (se aplicável)"],
              ["validUntil", "Fim da vigência (se aplicável)"],
              ["notes", "Observações da contratação"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === "notes" ? "text" : "date"}
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="table-wrap">
          <table className="dl-contract-table">
            <thead>
              <tr>
                <th>Código / material / previsto</th>
                <th>Resultado</th>
                <th>Fornecedor / identificação</th>
                <th>Pedido MXM / data</th>
                <th>Quantidade final</th>
                <th>Preço final (R$)</th>
                <th>Total final</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((line) => {
                const item = items.find((item) => item.id === line.itemId);
                const award = value.awards.find(
                  (award) => award.lineId === line.id,
                );
                const notAwarded = value.notAwarded.find(
                  (result) => result.lineId === line.id,
                );
                let amount = "A definir";
                try {
                  if (award) {
                    const result = awardTotal(
                      materializeContract({ ...value, awards: [award] })
                        .awards[0],
                    );
                    if (result !== null) amount = formatMoney(result);
                  }
                } catch {
                  amount = "Revise os valores";
                }
                const input = (
                  key: keyof Pick<
                    AwardInput,
                    | "supplier"
                    | "supplierReference"
                    | "mxmOrder"
                    | "orderDate"
                    | "quantity"
                    | "price"
                  >,
                  label: string,
                  placeholder?: string,
                ) =>
                  award ? (
                    <input
                      aria-label={`${label} ${item?.code}`}
                      title={label}
                      placeholder={placeholder}
                      type={key === "orderDate" ? "date" : "text"}
                      inputMode={
                        key === "quantity" || key === "price"
                          ? "decimal"
                          : undefined
                      }
                      value={award[key]}
                      onChange={(e) =>
                        patchAward(award.id, { [key]: e.target.value })
                      }
                    />
                  ) : null;
                return (
                  <tr key={line.id}>
                    <td>
                      <strong>{item?.code ?? line.itemId}</strong>
                      <span className="dl-spec">
                        {item?.description ?? "Material"}
                      </span>
                      <small className="dl-spec">
                        Previsto:{" "}
                        {decimalInput(line.quantityMilli, 3) || "A definir"}{" "}
                        {line.unit} ·{" "}
                        {lineSubtotal(line) === null
                          ? "Preço a definir"
                          : formatMoney(lineSubtotal(line)!)}
                      </small>
                    </td>
                    <td>
                      <select
                        aria-label={`Resultado ${item?.code}`}
                        value={
                          award ? "awarded" : notAwarded ? "not-awarded" : ""
                        }
                        onChange={(e) => {
                          if (
                            (award || notAwarded) &&
                            !window.confirm(
                              "Trocar o resultado deste material? Os dados finais deste item serão removidos ao salvar. O orçamento será preservado.",
                            )
                          )
                            return;
                          const base = {
                            ...value,
                            awards: value.awards.filter(
                              (award) => award.lineId !== line.id,
                            ),
                            notAwarded: value.notAwarded.filter(
                              (result) => result.lineId !== line.id,
                            ),
                          };
                          if (e.target.value === "awarded")
                            base.awards.push({
                              id: `award-${crypto.randomUUID()}`,
                              lineId: line.id,
                              supplier: "",
                              supplierReference: "",
                              mxmOrder: "",
                              orderDate: "",
                              quantity: "",
                              price: "",
                            });
                          if (e.target.value === "not-awarded")
                            base.notAwarded.push({
                              lineId: line.id,
                              reason: "",
                            });
                          onChange(base);
                        }}
                      >
                        <option value="">A definir</option>
                        <option value="awarded">Contratado</option>
                        <option value="not-awarded">Não contratado</option>
                      </select>
                    </td>
                    {award ? (
                      <>
                        <td>
                          <div className="dl-cell-fields">
                            {input("supplier", "Fornecedor", "Fornecedor")}
                            {input(
                              "supplierReference",
                              "Identificação do fornecedor (código MXM ou CNPJ)",
                              "Código MXM / CNPJ",
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="dl-cell-fields">
                            {input(
                              "mxmOrder",
                              "Pedido de compra MXM",
                              "Pedido MXM",
                            )}
                            {input("orderDate", "Data do pedido MXM")}
                          </div>
                        </td>
                        <td>
                          {input(
                            "quantity",
                            `Quantidade contratada (${line.unit})`,
                          )}
                          <small className="dl-spec">{line.unit}</small>
                        </td>
                        <td>{input("price", "Preço unitário final (R$)")}</td>
                        <td>{amount}</td>
                      </>
                    ) : (
                      <td colSpan={5}>
                        {notAwarded ? (
                          <label className="dl-result-reason">
                            Motivo da não contratação
                            <input
                              aria-label={`Motivo da não contratação ${item?.code}`}
                              value={notAwarded.reason}
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  notAwarded: value.notAwarded.map((result) =>
                                    result.lineId === line.id
                                      ? { ...result, reason: e.target.value }
                                      : result,
                                  ),
                                })
                              }
                            />
                          </label>
                        ) : (
                          <span className="muted">
                            Selecione o resultado deste material.
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!plan.lines.length && (
          <p className="empty-state">
            Inclua os materiais e conclua o planejamento antes de registrar a
            contratação.
          </p>
        )}
      </fieldset>
      {readOnly && (
        <p className="muted">
          {plan.contract?.release
            ? "Contratação concluída e protegida. A origem dos saldos é preservada."
            : "Conclua o planejamento para registrar a contratação. Para processos suspensos ou cancelados, revise a situação antes de continuar."}
        </p>
      )}
    </>
  );
}
