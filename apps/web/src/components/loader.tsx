import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div
      className="flex min-h-[200px] items-center justify-center"
      style={{ color: "var(--t3)" }}
    >
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}