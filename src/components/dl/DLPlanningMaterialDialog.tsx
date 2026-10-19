import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Item } from "../../types";
import type { DLPlan, DLPlanningLine } from "../../types/dl";
import {
  formatMoney,
  lineSubtotal,
  parseScaledInput,
} from "../../services/dlPlanning";

export default function DLPlanningMaterialDialog({
  plan,
  line,
  item,
  quantity,
  price,
  dirty,
  onClose,
}: {
  plan: DLPlan;
  line: DLPlanningLine;
  item?: Item;
  quantity: string;
  price: string;
  dirty: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  let amount = "A definir";
  try {
    const value = lineSubtotal({
      ...line,
      quantityMilli: parseScaledInput(quantity, 3, "Quantidade"),
      estimatedPriceCents: parseScaledInput(price, 2, "Preço previsto"),
    });
    if (value !== null) amount = formatMoney(value);
  } catch {
    amount = "Revise os valores digitados";
  }
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog dl-planning-material-dialog"
      aria-labelledby="dl-planning-material-title"
      onClose={onClose}
    >
      <header>
        <div>
          <p>
            {plan.code} · {plan.title}
          </p>
          <h2 id="dl-planning-material-title">
            {item?.description || "Cadastro indisponível"}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar material do planejamento"
          onClick={() => ref.current?.close()}
        >
          <X size={18} />
        </button>
      </header>
      <div className="dl-planning-material-body">
        <dl>
          <div>
            <dt>Código MXM</dt>
            <dd>{item?.code || line.itemId}</dd>
          </div>
          <div>
            <dt>Unidade do planejamento</dt>
            <dd>{line.unit}</dd>
          </div>
          <div>
            <dt>Categoria da aquisição</dt>
            <dd>{plan.category || "Não informada"}</dd>
          </div>
          <div>
            <dt>Grupo do cadastro</dt>
            <dd>{item?.group || "Não informado"}</dd>
          </div>
          <div>
            <dt>Quantidade prevista</dt>
            <dd>{quantity ? `${quantity} ${line.unit}` : "A definir"}</dd>
          </div>
          <div>
            <dt>Preço unitário previsto</dt>
            <dd>{price ? `R$ ${price}` : "A definir"}</dd>
          </div>
          <div>
            <dt>Subtotal previsto</dt>
            <dd>{amount}</dd>
          </div>
          <div>
            <dt>Situação da aquisição</dt>
            <dd>{plan.stage}</dd>
          </div>
          <div className="dl-planning-material-full">
            <dt>Especificação técnica</dt>
            <dd>
              {item?.technicalSpecification || "Não informada no cadastro."}
            </dd>
          </div>
        </dl>
        <p className="form-note">
          {dirty ? "Valores em edição, ainda não salvos. " : ""}Consulta do
          planejamento. O orçamento previsto não constitui saldo contratado.
        </p>
      </div>
      <footer>
        <button
          type="button"
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
      </footer>
    </dialog>
  );
}
