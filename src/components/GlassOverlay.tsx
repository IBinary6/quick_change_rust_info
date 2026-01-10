import { ReactNode } from "react";

interface Props {
  active: boolean;
  fullscreen?: boolean;
  className?: string;
  children: ReactNode;
}

export function GlassOverlay({ active, fullscreen, className, children }: Props) {
  if (!active) return null;
  const classes = ["glass-overlay", fullscreen ? "fullscreen" : "", className || ""]
    .filter(Boolean)
    .join(" ");
  return <div className={classes}>{children}</div>;
}
