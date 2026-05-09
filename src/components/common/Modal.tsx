import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export default function Modal({ open, title, children, footer, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

