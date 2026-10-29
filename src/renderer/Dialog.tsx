import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}
export function Modal({ title, children, onClose, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="dialog-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
