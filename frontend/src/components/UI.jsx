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

// ── Botão Exportar com opções Excel e PDF ──
export function ExportBtn({ rows, columns, filename }) {
  const [open, setOpen] = useState(false);

  const exportXLS = () => {
    setOpen(false);
    const header = columns.map(c => c.label);
    const data = rows.map(r => columns.map(c => c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? '')));
    const ws = window.XLSX.utils.aoa_to_sheet([header, ...data]);
    // Larguras automáticas
    ws['!cols'] = columns.map(c => ({ wch: Math.max(c.label.length, 12) }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    window.XLSX.writeFile(wb, `${filename || 'export'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  const exportPDF = async () => {
    setOpen(false);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape
      const pw = 297, margin = 10;
      const usable = pw - margin * 2;
      let y = margin;

      // Título
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(26, 39, 64);
      pdf.text(filename || 'Relatório', margin, y + 6);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margin, y + 12);
      y += 18;

      // Calcular larguras proporcionais
      const totalChars = columns.reduce((s, c) => s + Math.max(c.label.length, 8), 0);
      const colWidths = columns.map(c => (Math.max(c.label.length, 8) / totalChars) * usable);

      // Header da tabela
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, usable, 7, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, y, usable, 7, 'S');
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(55, 65, 81);
      let cx = margin;
      columns.forEach((col, i) => {
        pdf.text(col.label, cx + 2, y + 5);
        cx += colWidths[i];
      });
      y += 7;

      // Linhas
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      rows.forEach((row, ri) => {
        if (y > 195) { pdf.addPage(); y = margin; }
        const rowH = 6;
        if (ri % 2 === 1) { pdf.setFillColor(248, 249, 252); pdf.rect(margin, y, usable, rowH, 'F'); }
        pdf.setDrawColor(240, 240, 240);
        pdf.line(margin, y + rowH, margin + usable, y + rowH);
        pdf.setTextColor(26, 39, 64);
        cx = margin;
        columns.forEach((col, i) => {
          const val = col.fmt ? col.fmt(row[col.key]) : String(row[col.key] ?? '—');
          pdf.text(val.substring(0, 40), cx + 2, y + 4);
          cx += colWidths[i];
        });
        y += rowH;
      });

      // Download
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename || 'export'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch(e) { console.error('Erro PDF:', e); }
  };

  if (!rows?.length) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        ⬇ Exportar
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 99,
            background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)', minWidth: 160, overflow: 'hidden',
          }}>
            <button onClick={exportXLS} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
              border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
              fontFamily: 'inherit', textAlign: 'left',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <span style={{ fontSize: 16 }}>📊</span> Excel (.xlsx)
            </button>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <button onClick={exportPDF} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
              border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
              fontFamily: 'inherit', textAlign: 'left',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <span style={{ fontSize: 16 }}>📄</span> PDF (.pdf)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
