import DLMoneyInput from "./DLMoneyInput";
import { automaticContractValidity } from "../../services/dlDates";
import type {
  DLContract,
  DLContractAward,
  DLPlan,
  DLPlanningLine,
} from "../../types/dl";
import type { Item } from "../../types";
import { emptyDLContract, awardTotal } from "../../services/dlContract";
import {
  decimalInput,
  formatMoney,
  parseScaledInput,
} from "../../services/dlPlanning";
export type AwardInput = Omit<
  DLContractAward,
  "quantityMilli" | "unitPriceCents"
> & { quantity: string; price: string };
export type ContractInput = Omit<DLContract, "awards"> & {
  awards: AwardInput[];
};
export function contractInput(
  contract?: DLContract,
  plannedLines: DLPlanningLine[] = [],
): ContractInput {
  const value = contract ?? emptyDLContract();
  return {
    ...value,
    ...(!value.release ? { orderDatesFromContract: true as const } : {}),
    ...(!value.validityMode && !value.validFrom && !value.validUntil
      ? { validityMode: "automatic" as const, validityMonths: null }
      : {}),
    awards: value.awards.map(({ quantityMilli, unitPriceCents, ...award }) => ({
      ...award,
      quantity: decimalInput(
        quantityMilli ??
          plannedLines.find((line) => line.id === award.lineId)
            ?.quantityMilli ??
          null,
        3,
      ),
      price: decimalInput(unitPriceCents, 2),
    })),
  };
}
export function materializeContract(value: ContractInput): DLContract {
  return automaticContractValidity({
    ...value,
    awards: value.awards.map(({ quantity, price, ...award }) => ({
      ...award,
      orderDate:
        value.orderDatesFromContract && value.signedOn
          ? value.signedOn
          : award.orderDate,
      quantityMilli: parseScaledInput(quantity, 3, "Quantidade contratada"),
      unitPriceCents: parseScaledInput(price, 2, "Preço final"),
    })),
  });
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
  return (
    <>
      <fieldset disabled={readOnly} className="dl-contract-fields">
        <div className="table-wrap">
          <table className="dl-contract-table">
            <thead>
              <tr>
                <th>Código / material</th>
                <th>Resultado</th>
                <th>Fornecedor</th>
                <th>Pedido MXM</th>
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
                    key === "price" ? (
                      <DLMoneyInput
                        label={`${label} ${item?.code}`}
                        value={award.price}
                        disabled={readOnly}
                        onChange={(price) => patchAward(award.id, { price })}
                      />
                    ) : (
                      <input
                        aria-label={`${label} ${item?.code}`}
                        title={label}
                        placeholder={placeholder}
                        type={key === "orderDate" ? "date" : "text"}
                        inputMode={key === "quantity" ? "decimal" : undefined}
                        readOnly={key === "quantity"}
                        value={award[key]}
                        onChange={(e) =>
                          patchAward(award.id, { [key]: e.target.value })
                        }
                      />
                    )
                  ) : null;
                return (
                  <tr key={line.id}>
                    <td>
                      <strong>{item?.code ?? line.itemId}</strong>
                      <span className="dl-spec">
                        {item?.description ?? "Material"}
                      </span>
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
                              quantity: decimalInput(line.quantityMilli, 3),
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
                          </div>
                        </td>
                        <td>
                          <div className="dl-cell-fields">
                            {input(
                              "mxmOrder",
                              "Pedido de compra MXM",
                              "Pedido MXM",
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="dl-quantity-control">
                            {input(
                              "quantity",
                              `Quantidade contratada (${line.unit})`,
                            )}
                            <span>{line.unit}</span>
                          </div>
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
    </>
  );
}
