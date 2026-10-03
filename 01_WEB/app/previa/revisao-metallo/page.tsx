import { notFound } from "next/navigation";
import { ReviewPreview } from "./review-preview";

export default function MetalloReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReviewPreview />;
}
