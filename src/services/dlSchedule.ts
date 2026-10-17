import type { DLPlan, DLSchedule } from "../types/dl";
import {
  addCalendarMonths,
  addDeliveryDays,
  validDateOnly,
} from "./dlDates.ts";
export const emptyDLSchedule = (): DLSchedule => ({
  coverageStart: "",
  coverageMonths: null,
  plannedAuthorizationOn: "",
  authorizationRequestedOn: "",
  authorizationGrantedOn: "",
  plannedRequestOn: "",
  processMonths: 1,
  deliveryDays: 10,
  deliveryDayBasis: "",
  deliveredOn: "",
});
export function validateDLSchedule(plan: DLPlan) {
  const schedule = plan.schedule;
  if (!schedule) return;
  for (const field of [
    "coverageStart",
    "plannedAuthorizationOn",
    "authorizationRequestedOn",
    "authorizationGrantedOn",
    "plannedRequestOn",
    "deliveredOn",
  ] as const)
    if (
      typeof schedule[field] !== "string" ||
      (schedule[field] && !validDateOnly(schedule[field]))
    )
      throw new Error("Há uma data inválida no cronograma.");
  for (const field of ["coverageMonths", "processMonths"] as const) {
    const value = schedule[field];
    if (
      value !== null &&
      (!Number.isSafeInteger(value) || value < 1 || value > 1200)
    )
      throw new Error(
        "Os períodos do cronograma devem ter de 1 a 1200 meses inteiros.",
      );
  }
  if (
    schedule.deliveryDays !== null &&
    (!Number.isSafeInteger(schedule.deliveryDays) ||
      schedule.deliveryDays < 0 ||
      schedule.deliveryDays > 3650)
  )
    throw new Error("Informe um prazo de entrega de 0 a 3650 dias inteiros.");
  if (!["", "calendar", "business"].includes(schedule.deliveryDayBasis))
    throw new Error("Escolha dias corridos ou úteis para a entrega.");
  if (
    schedule.authorizationGrantedOn &&
    schedule.authorizationRequestedOn &&
    schedule.authorizationGrantedOn < schedule.authorizationRequestedOn
  )
    throw new Error(
      "A autorização não pode ser anterior à solicitação à gerência.",
    );
  if (
    schedule.deliveredOn &&
    plan.contract?.signedOn &&
    schedule.deliveredOn < plan.contract.signedOn
  )
    throw new Error(
      "A entrega registrada no cronograma não pode ser anterior à emissão do pedido.",
    );
  scheduleDates(plan);
}
export function scheduleDates(plan: DLPlan) {
  const schedule = plan.schedule ?? emptyDLSchedule();
  const coverageEnd =
    schedule.coverageStart && schedule.coverageMonths
      ? addCalendarMonths(schedule.coverageStart, schedule.coverageMonths)
      : "";
  const processDue =
    schedule.plannedRequestOn && schedule.processMonths
      ? addCalendarMonths(schedule.plannedRequestOn, schedule.processMonths)
      : "";
  const actualProcessDue =
    plan.request.date && schedule.processMonths
      ? addCalendarMonths(plan.request.date, schedule.processMonths)
      : "";
  const delivery = (date: string) =>
    date && schedule.deliveryDays !== null && schedule.deliveryDayBasis
      ? addDeliveryDays(date, schedule.deliveryDays, schedule.deliveryDayBasis)
      : "";
  return {
    coverageEnd,
    processDue,
    actualProcessDue,
    plannedDeliveryDue: delivery(processDue || actualProcessDue),
    orderDeliveryDue: delivery(plan.contract?.signedOn ?? ""),
    validUntil: plan.contract?.validUntil ?? "",
  };
}
export function milestoneStatus(
  expected: string,
  actual: string,
  today: string,
) {
  if (actual) {
    if (!expected) return "Realizado · sem previsão";
    return actual <= expected ? "Realizado no prazo" : "Realizado com atraso";
  }
  if (!expected) return "A definir";
  if (expected < today) return "Atrasado";
  const days = Math.round(
    (Date.parse(expected + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) /
      86400000,
  );
  return days <= 3 ? "Vence em até 3 dias" : "No prazo";
}
