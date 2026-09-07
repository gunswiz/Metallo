import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/dashboard" aria-label="Metallo — início">
      <Image
        className={compact ? "brand-logo compact" : "brand-logo"}
        src="/metallo-logo.png"
        alt="Metallo Montagens Industriais"
        width={156}
        height={65}
        priority
      />
    </Link>
  );
}
