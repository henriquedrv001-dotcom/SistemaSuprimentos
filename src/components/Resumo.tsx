import type { ReactNode } from "react";

export function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><span className="muted">{label}</span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}
export function DateInfo({ label, value }: { label: string; value: string }) {
  const formatted = value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
  return <div className="date-info"><span>{label}</span><strong>{formatted}</strong></div>;
}
