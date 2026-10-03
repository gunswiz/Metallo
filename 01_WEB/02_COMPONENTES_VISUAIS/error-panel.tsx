import { CircleAlert } from "lucide-react";

export function ErrorPanel({ message, title = "Não foi possível carregar" }: { message: string; title?: string }) {
  return (
    <div className="empty-state" role="alert">
      <CircleAlert size={34} aria-hidden />
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
