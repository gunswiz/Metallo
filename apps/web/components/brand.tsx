import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/dashboard" aria-label="Metallo — início">
      <Image src="/metallo-mark.svg" alt="" width={36} height={36} priority />
      {!compact && (
        <span>
          <strong>METALLO</strong>
          <small>GESTÃO INDUSTRIAL</small>
        </span>
      )}
    </Link>
  );
}
