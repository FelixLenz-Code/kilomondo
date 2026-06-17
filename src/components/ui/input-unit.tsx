import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Text input with a trailing unit label (e.g. "L", "€", "km"). */
const InputUnit = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { unit: string }
>(({ unit, className, ...props }, ref) => (
  <div className="relative">
    <Input ref={ref} className={cn("pr-12", className)} {...props} />
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
      {unit}
    </span>
  </div>
));
InputUnit.displayName = "InputUnit";

export { InputUnit };
