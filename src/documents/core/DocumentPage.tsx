import type { ReactNode } from "react";

type DocumentPageProps = {
  children: ReactNode;
  orientation?: "portrait" | "landscape";
  className?: string;
};

export function DocumentPage({ children, orientation = "portrait", className }: DocumentPageProps) {
  const classes = ["doc-sheet", className].filter(Boolean).join(" ");

  return (
    <article className={classes} data-orientation={orientation}>
      {children}
    </article>
  );
}