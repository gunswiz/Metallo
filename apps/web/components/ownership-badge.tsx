export function OwnershipBadge({ type }: { type: string | null | undefined }) {
  const rented = type === "rented";
  return (
    <span className={`ownership-badge ${rented ? "rented" : "owned"}`}>
      {rented ? "ALUGADO" : "PRÓPRIO"}
    </span>
  );
}
