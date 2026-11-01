"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned under the content, usually a PrimaryButton. */
  footer?: React.ReactNode;
};

/** Bottom sheet: grabber, title left, Cancel right. Drag down or Esc to close. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-[440px] flex-col rounded-t-[28px] border-t border-border-strong bg-[#111] px-5"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto mt-2.5 h-[5px] w-9 rounded-full bg-white/25" />
              <div className="flex items-center justify-between pt-4 pb-4">
                <h2 className="text-[20px] font-extrabold tracking-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-[14px] font-semibold text-muted transition-colors hover:text-text"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="-mx-5 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && <div className="pt-2 pb-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
