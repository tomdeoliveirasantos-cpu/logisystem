import { useState } from 'react';

export function Badge({ type = 'blue', children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const map = {
    entregue:  { type: 'green', label: 'Entregue' },
    devolucao: { type: 'red',   label: 'Devolução' },
    pendente:  { type: 'amber', label: 'Pendente' },
    cancelado: { type: 'red',   label: 'Cancelado' },
    recebido:  { type: 'green', label: 'Recebido' },
    pago:      { type: 'green', label: 'Pago' },
    vencido:   { type: 'red',   label: 'Vencido' },
    proprio:   { type: 'teal',  label: 'Próprio' },
    terceiros: { type: 'blue',  label: 'Terceiros' },
    frota:     { type: 'teal',  label: 'Frota' },
    agregado:  { type: 'blue',  label: 'Agregado' },
    preventiva:{ type: 'blue',  label: 'Preventiva' },
    corretiva: { type: 'amber', label: 'Corretiva' },
  };
  const s = map[status] || { type: 'blue', label: status };
  return <Badge type={s.type}>{s.label}</Badge>;
}

export function Spinner() {
  return (
    <div style={{
      width: 20, height: 20,
      border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  );
}

export function LoadingRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div style={{
            height: 14, background: 'var(--bg3)',
            borderRadius: 4,
            width: `${60 + Math.random() * 30}%`,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  );
}

export function Modal({ title, onClose, children, width = 600 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: width,
        maxHeight: '90vh', overflow: 'auto',
        animation: 'fadeUp .2s ease both',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 18, lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export function Input(props) {
  return <input className="form-input" {...props} />;
}

export function Select({ options = [], ...props }) {
  return (
    <select className="form-select" {...props}>
      <option value="">Selecione...</option>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  );
}

export function Textarea(props) {
  return <textarea className="form-textarea" {...props} />;
}

export function Toast({ msg, type = 'success', onClose }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
      border: `1px solid ${type === 'success' ? 'var(--green)' : 'var(--red)'}`,
      color: type === 'success' ? 'var(--green)' : 'var(--red)',
      padding: '10px 16px', borderRadius: 'var(--radius)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fadeUp .2s ease both',
      fontSize: 13, fontWeight: 500,
    }}>
      {type === 'success' ? '✓' : '✕'} {msg}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, showToast: show };
}
