import type { DLPlan, DLSchedule, DLPlanEvent } from "../../types/dl";
import { milestoneStatus, scheduleDates } from "../../services/dlSchedule";
import { todayInBrazil } from "../../services/dlPlanning";
import { contractStatus } from "../../services/dlContract";
const date = (value: string) =>
  value ? value.split("-").reverse().join("/") : "A definir";
export default function DLSchedulePanel({
  plan,
  value,
  onChange,
  readOnly = false,
  events = [],
}: {
  plan: DLPlan;
  value: DLSchedule;
  onChange: (value: DLSchedule) => void;
  readOnly?: boolean;
  events?: DLPlanEvent[];
}) {
  let dates: ReturnType<typeof scheduleDates> | null = null;
  let error = "";
  try {
    dates = scheduleDates({ ...plan, schedule: value });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Revise os prazos.";
  }
  const today = todayInBrazil();
  const rows = [
    {
      label: "Autorização da gerência",
      expected: value.plannedAuthorizationOn,
      actual: value.authorizationGrantedOn,
      note: value.authorizationRequestedOn
        ? `Solicitada em ${date(value.authorizationRequestedOn)}`
        : "Solicitação à gerência a registrar",
    },
    {
      label: "Requisição MXM",
      expected: value.plannedRequestOn,
      actual: plan.request.date,
      note: plan.request.mxmNumber
        ? `Requisição ${plan.request.mxmNumber}`
        : "Número e data registrados na aba Requisição e processo",
    },
    {
      label: "Emissão do pedido",
      expected: dates?.processDue || dates?.actualProcessDue || "",
      actual: plan.contract?.signedOn ?? "",
      note: dates?.actualProcessDue
        ? `Prazo a partir da requisição real: ${date(dates.actualProcessDue)}`
        : "Previsão baseada na requisição prevista e prazo do processo",
    },
    {
      label: "Entrega",
      expected: dates?.plannedDeliveryDue ?? "",
      actual: value.deliveredOn,
      note: dates?.orderDeliveryDue
        ? `Prazo após pedido real: ${date(dates.orderDeliveryDue)}`
        : "Selecione dias corridos ou úteis para calcular o prazo",
    },
  ];
  return (
    <>
      <h3>Cronograma do processo</h3>
      <p className="muted">
        Compare o previsto com o realizado. As datas da requisição e da
        contratação vêm dos dados salvos nas respectivas abas. Alterações nas
        previsões ficam no histórico.
      </p>
      <fieldset disabled={readOnly} className="dl-contract-fields">
        <div className="form-grid dl-schedule-fields">
          <label>
            Início do período de abastecimento
            <input
              type="date"
              value={value.coverageStart}
              onChange={(e) =>
                onChange({ ...value, coverageStart: e.target.value })
              }
            />
          </label>
          <label>
            Fim previsto do abastecimento
            <input readOnly value={date(dates?.coverageEnd ?? "")} />
          </label>
          <label>
            Período de abastecimento (meses)
            <input
              type="number"
              min="1"
              max="1200"
              step="1"
              aria-label="Período de abastecimento (meses)"
              value={value.coverageMonths ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  coverageMonths:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <small className="muted">
              Período que as quantidades devem atender; separado da vigência da
              contratação.
            </small>
          </label>
          <label>
            Início do planejamento
            <input readOnly value={date(plan.openedOn)} />
          </label>
          {(
            [
              ["plannedAuthorizationOn", "Autorização prevista para"],
              ["plannedRequestOn", "Data prevista da requisição MXM"],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                type="date"
                value={value[field]}
                onChange={(e) =>
                  onChange({ ...value, [field]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Prazo previsto do processo (meses)
            <input
              type="number"
              min="1"
              max="1200"
              step="1"
              value={value.processMonths ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  processMonths:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Prazo de entrega após o pedido (dias)
            <input
              type="number"
              min="0"
              max="3650"
              step="1"
              value={value.deliveryDays ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  deliveryDays:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Contagem do prazo de entrega
            <select
              aria-label="Contagem do prazo de entrega"
              value={value.deliveryDayBasis}
              onChange={(e) =>
                onChange({
                  ...value,
                  deliveryDayBasis: e.target
                    .value as DLSchedule["deliveryDayBasis"],
                })
              }
            >
              <option value="">Escolha a contagem</option>
              <option value="calendar">Dias corridos</option>
              <option value="business">Dias úteis (segunda a sexta)</option>
            </select>
            <small className="muted">
              Dias úteis excluem sábados e domingos; feriados ainda não são
              considerados.
            </small>
          </label>
          <label>
            Entrega realizada em (acompanhamento)
            <input
              type="date"
              aria-label="Entrega realizada em (acompanhamento)"
              value={value.deliveredOn}
              onChange={(e) =>
                onChange({ ...value, deliveredOn: e.target.value })
              }
            />
            <small className="muted">
              Registro informativo: não confirma recebimento nem movimenta
              saldos.
            </small>
          </label>
        </div>
        <details className="dl-schedule-actuals">
          <summary>Registrar autorização da gerência</summary>
          <div className="form-grid">
            {([
              ["authorizationRequestedOn", "Autorização solicitada à gerência em"],
              ["authorizationGrantedOn", "Autorização recebida em"],
            ] as const).map(([field, label]) => (
              <label key={field}>{label}<input type="date" value={value[field]} onChange={(e) => onChange({ ...value, [field]: e.target.value })} /></label>
            ))}
          </div>
        </details>
      </fieldset>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table className="dl-schedule-table">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Previsão / prazo</th>
              <th>Realizado</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>
                  <strong>{row.label}</strong>
                  <small>{row.note}</small>
                </td>
                <td>{date(row.expected)}</td>
                <td>{date(row.actual)}</td>
                <td>
                  <MilestoneIndicator
                    expected={
                      row.label === "Entrega"
                        ? dates?.orderDeliveryDue || row.expected
                        : row.label === "Emissão do pedido"
                          ? dates?.actualProcessDue || row.expected
                          : row.expected
                    }
                    actual={row.actual}
                    today={today}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dl-schedule-validity">
        <strong>Vigência da contratação</strong>
        <p>
          {plan.contract?.validFrom
            ? `${date(plan.contract.validFrom)} a ${date(dates?.validUntil ?? "")}${plan.contract.validityMonths ? ` · ${plan.contract.validityMonths} mês(es)` : ""}`
            : "Informe a data-base e os meses na aba Contratação e fornecedores."}
        </p>
        {plan.contract?.release && <span>{contractStatus(plan, today)}</span>}
      </div>
      <p className="muted">
        As previsões usam a data prevista da requisição; quando ela não é
        informada, usam a data real. Os indicadores do processo e da entrega
        usam os prazos contados da requisição e do pedido reais, quando
        registrados. Os avisos não bloqueiam o andamento do processo.
      </p>      <section className="dl-milestone-history" aria-label="Histórico de etapas">
        <h4>Histórico de etapas</h4>
        {events.filter(event => event.planId === plan.id && /conclu|aprova|análise|analis|devol|reab|requisição enviada|geração da requisição/i.test(event.action)).length ? (
          <ol>{events.filter(event => event.planId === plan.id && /conclu|aprova|análise|analis|devol|reab|requisição enviada|geração da requisição/i.test(event.action)).map(event => (
            <li key={event.id}><span>{event.action}</span><small>{new Date(event.timestamp).toLocaleString("pt-BR")} · {event.actor}</small></li>
          ))}</ol>
        ) : <p className="muted">Nenhuma aprovação ou fechamento de etapa registrado.</p>}
      </section>

    </>
  );
}

function MilestoneIndicator({
  expected,
  actual,
  today,
}: {
  expected: string;
  actual: string;
  today: string;
}) {
  const status = milestoneStatus(expected, actual, today);
  const tone = status.toLocaleLowerCase("pt-BR").includes("atras")
    ? "dl-tag-late"
    : status.startsWith("Vence")
      ? "tag-amber"
      : status === "A definir" || status.includes("sem previsão")
        ? "tag-neutral"
        : "tag-green";
  return <span className={`tag ${tone}`}>{status}</span>;
}
