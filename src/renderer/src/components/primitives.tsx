import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* --------------------------------- Botones -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  disabled?: boolean
  size?: 'md' | 'lg'
  className?: string
  title?: string
  autoFocus?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  // Deshabilitado va sobre `surface-2` y no sobre `line`. Con `line` el texto
  // quedaba en 1,86:1 —gris sobre gris, prácticamente ilegible— y "Generar
  // tarjetas" era justo el botón que más tiempo pasa deshabilitado: mientras
  // falta el modelo, que es el primer rato de todo comprador nuevo. Lo encontró
  // la sonda de contraste de `qa/vista.mjs`.
  primary:
    'bg-brand text-on-brand hover:bg-brand-soft active:bg-brand disabled:bg-surface-2 disabled:text-ink-faint shadow-[0_1px_0_var(--color-bevel)_inset]',
  secondary: 'bg-surface-2 text-ink border border-line-strong hover:border-ink-faint hover:bg-line disabled:text-ink-faint',
  ghost: 'text-ink-dim hover:text-ink hover:bg-surface-2 disabled:text-ink-faint',
  danger: 'bg-surface-2 text-bad border border-line-strong hover:border-bad/60 hover:bg-bad/10'
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  size = 'md',
  className,
  title,
  autoFocus
}: ButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      autoFocus={autoFocus}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 select-none disabled:cursor-default',
        size === 'lg' ? 'h-11 px-5 text-[15px]' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------------- Segmentos ------------------------------- */

export interface SegmentOption<T extends string> {
  value: T
  label: string
  hint?: string
}

interface SegmentedProps<T extends string> {
  options: Array<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  ariaLabel: string
}

export function Segmented<T extends string>({ options, value, onChange, disabled, ariaLabel }: SegmentedProps<T>): ReactNode {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex rounded-xl border border-line bg-surface p-1', disabled && 'opacity-60')}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 disabled:cursor-default',
              active ? 'bg-brand text-on-brand' : 'text-ink-dim hover:text-ink'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------- Cards --------------------------------- */

interface SelectCardProps {
  title: string
  subtitle: string
  footnote?: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}

export function SelectCard({ title, subtitle, footnote, selected, disabled, onClick }: SelectCardProps): ReactNode {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border p-3.5 text-left transition-all duration-150 disabled:cursor-default',
        selected
          ? 'border-brand bg-brand/10 ring-1 ring-brand/40'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
        disabled && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-sm font-semibold', selected ? 'text-ink' : 'text-ink-dim')}>{title}</span>
        <span
          className={cn(
            'size-3.5 shrink-0 rounded-full border transition-colors',
            selected ? 'border-brand bg-brand' : 'border-line-strong'
          )}
        />
      </div>
      <p className="mt-1 text-xs leading-snug text-ink-faint">{subtitle}</p>
      {footnote ? <p className="mt-1.5 text-[11px] font-medium text-ink-faint">{footnote}</p> : null}
    </button>
  )
}

/* --------------------------------- Progreso -------------------------------- */

interface ProgressBarProps {
  /** 0..100, o `null` para barra indeterminada. */
  percent: number | null
  tone?: 'brand' | 'good' | 'bad'
  className?: string
}

export function ProgressBar({ percent, tone = 'brand', className }: ProgressBarProps): ReactNode {
  const toneClass = tone === 'good' ? 'bg-good' : tone === 'bad' ? 'bg-bad' : 'bg-brand'
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      {percent === null ? (
        <div className={cn('animate-indeterminate absolute inset-y-0 w-1/4 rounded-full', toneClass)} />
      ) : (
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', toneClass)}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      )}
    </div>
  )
}

/* ---------------------------------- Banner -------------------------------- */

interface BannerProps {
  tone: 'info' | 'warn' | 'error' | 'success'
  children: ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

const BANNER_TONES: Record<BannerProps['tone'], string> = {
  info: 'border-line-strong bg-surface-2 text-ink-dim',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  error: 'border-bad/30 bg-bad/10 text-bad',
  success: 'border-good/30 bg-good/10 text-good'
}

export function Banner({ tone, children, action, onDismiss }: BannerProps): ReactNode {
  return (
    <div
      className={cn(
        'animate-in-up flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed',
        BANNER_TONES[tone]
      )}
    >
      <div className="selectable flex-1">{children}</div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 rounded-lg px-2 py-0.5 text-[13px] font-semibold underline decoration-current/40 underline-offset-2 hover:decoration-current"
        >
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="shrink-0 px-1 opacity-60 hover:opacity-100" title="Cerrar aviso">
          ✕
        </button>
      ) : null}
    </div>
  )
}

/* ---------------------------------- Campos --------------------------------- */

interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
  autoFocus?: boolean
  maxLength?: number
  disabled?: boolean
  onEnter?: () => void
  onEscape?: () => void
  className?: string
}

const CAMPO =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-ink placeholder:text-ink-faint transition-colors focus:border-brand focus:outline-none disabled:opacity-60'

export function Input({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
  maxLength,
  disabled,
  onEnter,
  onEscape,
  className
}: InputProps): ReactNode {
  const alTeclado = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault()
      onEnter()
    } else if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      onEscape()
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onKeyDown={alTeclado}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      maxLength={maxLength}
      disabled={disabled}
      // `selectable` porque el reset global de index.css apaga la selección de
      // texto en toda la interfaz para que se sienta nativa. En un campo de texto
      // eso rompe poder seleccionar lo que uno escribió.
      className={cn(CAMPO, 'selectable h-10 text-sm', className)}
    />
  )
}

interface TextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
  rows?: number
  maxLength?: number
  disabled?: boolean
  className?: string
}

export function Textarea({ value, onChange, placeholder, ariaLabel, rows = 4, maxLength, disabled, className }: TextareaProps): ReactNode {
  return (
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
      className={cn(CAMPO, 'selectable resize-none py-2.5 text-sm leading-relaxed', className)}
    />
  )
}

/* --------------------------------- Dominio --------------------------------- */

interface MeterProps {
  /** 0..100. */
  percent: number
  /** Cuántas tarjetas hay detrás del número, para decidir si mostrarlo. */
  total: number
  className?: string
}

/**
 * La barra de "cuánto sé de esto".
 *
 * Con cero tarjetas NO muestra 0 %: muestra que está vacío. Un 0 % sobre un mazo
 * que todavía no existe se lee como un reproche, y no hay nada que reprochar —
 * el usuario recién creó la unidad.
 */
export function Meter({ percent, total, className }: MeterProps): ReactNode {
  if (total === 0) {
    return <div className={cn('h-1.5 w-full rounded-full bg-line', className)} aria-hidden />
  }

  const p = Math.max(0, Math.min(100, percent))
  // El color acompaña el avance en vez de ser siempre el de la marca: de un
  // vistazo, en una lista de diez unidades, se ve cuál está floja sin leer los
  // números.
  const tono = p >= 70 ? 'bg-good' : p >= 35 ? 'bg-warn' : 'bg-bad'

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-valuetext={`${p}% aprendido`}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tono)} style={{ width: `${p}%` }} />
    </div>
  )
}

/* ----------------------------------- Chip ---------------------------------- */

interface ChipProps {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'good' | 'warn' | 'bad'
}

const CHIP_TONOS: Record<NonNullable<ChipProps['tone']>, string> = {
  neutral: 'border-line-strong bg-surface-2 text-ink-faint',
  brand: 'border-brand/40 bg-brand/10 text-brand-soft',
  good: 'border-good/30 bg-good/10 text-good',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  bad: 'border-bad/30 bg-bad/10 text-bad'
}

export function Chip({ children, tone = 'neutral' }: ChipProps): ReactNode {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium', CHIP_TONOS[tone])}>
      {children}
    </span>
  )
}

/* --------------------------------- Vacío ----------------------------------- */

interface EmptyProps {
  icono: ReactNode
  titulo: string
  bajada: string
  accion?: ReactNode
}

/**
 * El estado vacío.
 *
 * Existe como primitivo porque una app de biblioteca está vacía muchas veces —sin
 * materias, sin unidades, sin tarjetas, sin resultados de búsqueda— y en todas
 * ellas lo que corresponde es lo mismo: decir qué falta y ofrecer el siguiente
 * paso. Una lista vacía sin explicación se lee como que la app se rompió.
 */
export function Empty({ icono, titulo, bajada, accion }: EmptyProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 text-ink-faint/50">{icono}</div>
      <h3 className="text-[15px] font-semibold text-ink-dim">{titulo}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-faint">{bajada}</p>
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  )
}
