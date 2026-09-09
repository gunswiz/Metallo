import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, href, icon: Icon }: { label: string; value: string | number; href?: string; icon: LucideIcon }) {
  const content = <>
      <span className="metric-icon"><Icon size={18} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
    </>;
  return href ? <Link className="metric-card" href={href}>{content}</Link> : <article className="metric-card">{content}</article>;
}
