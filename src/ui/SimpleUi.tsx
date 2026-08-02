import { ReactNode } from 'react';

/** Glass panel card */
export function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  className = '',
  lift = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  lift?: boolean;
}) {
  return (
    <section className={`panel rounded-[22px] ${lift ? 'card-lift' : ''} ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[15px]" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="truncate text-[14px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{title}</h2>}
              {subtitle && <p className="mt-0.5 truncate text-[11.5px]" style={{ color: 'var(--faint)' }}>{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={title ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </section>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--mute)' }}>{children}</span>
      {hint && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{hint}</span>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'generate';
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  className?: string;
}) {
  const v = {
    primary: 'btnx btn-primary btn-shine',
    generate: 'btnx btn-generate btn-shine',
    secondary: 'btnx btn-secondary',
    ghost: 'btnx btn-ghost',
    danger: 'btnx btn-danger',
    success: 'btnx btn-success btn-shine',
  }[variant];
  const s = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : 'btn-md';
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${v} ${s} ${className}`}>
      {children}
    </button>
  );
}

export function Tile({
  active,
  onClick,
  emoji,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  desc?: string;
}) {
  return (
    <button onClick={onClick} data-active={active} className="tile px-2 py-3">
      <span className="tile-emoji">{emoji}</span>
      <span className="tile-name">{label}</span>
      {desc && <span className="tile-desc">{desc}</span>}
    </button>
  );
}

export function RowItem({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button onClick={onClick} data-active={active} className="row-item">
      <span className="dot" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{title}</span>
        <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--faint)' }}>{desc}</span>
      </span>
    </button>
  );
}

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: ReactNode;
  variant?: 'default' | 'pine' | 'gold' | 'danger' | 'success';
  className?: string;
}) {
  const cls = {
    default: 'badge',
    pine: 'badge badge-pine',
    gold: 'badge badge-gold',
    danger: 'badge',
    success: 'badge badge-pine',
  }[variant];
  return <span className={`${cls} ${className}`}>{children}</span>;
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  desc?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-on={checked}
      onClick={() => onChange(!checked)}
      className="toggle"
    >
      <span className="min-w-0 text-left">
        <span className="block text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
        {desc && <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--faint)' }}>{desc}</span>}
      </span>
      <span className="track"><span className="knob" /></span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} data-active={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 2,
  maxLength,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}) {
  const cls = `field ${className}`;
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} placeholder={placeholder} className={cls} />;
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} className={cls} />;
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="my-4 h-px" style={{ background: 'var(--line)' }} />;
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
      <span className="text-[9.5px] font-bold uppercase tracking-[0.24em]" style={{ color: 'var(--faint)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
    </div>
  );
}
