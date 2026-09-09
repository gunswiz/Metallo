import { CircleAlert } from "lucide-react";

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="empty-state" role="alert">
      <CircleAlert size={34} aria-hidden />
      <strong>Não foi possível carregar</strong>
      <p>{message}</p>
    </div>
  );
}
