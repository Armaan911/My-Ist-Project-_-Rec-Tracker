"use client";
import { ReactNode } from "react";
import { createPortal } from "react-dom";

// Rendered through a portal to <body> so a transformed ancestor (e.g. the dashboard's
// animate-fade-up, which leaves transform: translateY(0)) can't capture our position:fixed
// and make the dialog stretch down the whole page. Portal => fixed is relative to the viewport.
export function Modal({
  open, onClose, title, description, children, footer, wide,
}: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/60" onClick={onClose} aria-hidden />
      <div className={`relative flex max-h-[calc(100vh-2rem)] w-full animate-scale-in flex-col ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-line bg-surface shadow-lg`}>
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line p-6 pt-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
