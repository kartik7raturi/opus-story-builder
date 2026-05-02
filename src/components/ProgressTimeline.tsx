import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

export function ProgressTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3">
          <div className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
            s.status === "done" && "bg-primary border-primary text-primary-foreground",
            s.status === "active" && "border-primary text-primary",
            s.status === "pending" && "border-muted text-muted-foreground",
            s.status === "error" && "border-destructive text-destructive",
          )}>
            {s.status === "done" && <Check className="h-3.5 w-3.5" />}
            {s.status === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {s.status === "pending" && <Circle className="h-2 w-2 fill-current" />}
            {s.status === "error" && <span className="text-xs font-bold">!</span>}
          </div>
          <div className="flex-1">
            <div className={cn(
              "font-medium",
              s.status === "active" && "text-primary",
              s.status === "pending" && "text-muted-foreground",
            )}>{s.label}</div>
            {s.detail && <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
