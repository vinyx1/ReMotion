/*
  Shared pieces of the therapist dashboard, in the Rehab Studio vocabulary:
  flat panels on plaster divided by hairlines (no shadows), forest ink, eucalyptus
  for focus and selection, terracotta only for a compensated rep.
*/
import { Check, ChevronDown } from 'lucide-react'
import { Select as RSelect } from 'radix-ui'
import type { ReactNode } from 'react'
import { useWidth } from '../lib/useWidth'
import { cn } from '../lib/utils'

export const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eucalyptus'

export function Panel({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className={cn('min-w-0 rounded-xl border border-wall bg-panel', className)}>
      {children}
    </section>
  )
}

export function PanelTitle({ title, caption, right, as: H = 'h2' }: {
  title: ReactNode
  caption?: ReactNode
  right?: ReactNode
  as?: 'h2' | 'h3'
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <H className="font-display text-xl leading-tight font-medium text-balance">{title}</H>
        {caption && <p className="mt-1 text-[15px] text-pretty text-forest-2">{caption}</p>}
      </div>
      {right}
    </header>
  )
}

/** A label over a measured value. Numbers are always mono with tabular figures. */
export function Readout({ label, value, note, tone, size = 'lg' }: {
  label: string
  value: string
  note?: ReactNode
  tone?: 'comp'
  size?: 'lg' | 'md'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-bold text-forest-2">{label}</dt>
      <dd className={cn(
        'mt-1 font-readout leading-none whitespace-nowrap tabular-nums',
        size === 'lg' ? 'text-[1.45rem] tracking-[-0.02em] sm:text-[2.5rem] lg:text-[1.75rem] xl:text-[2rem] 2xl:text-[2.5rem]' : 'text-2xl',
        tone === 'comp' && 'text-terra',
      )}>
        {value}
      </dd>
      {note && <dd className="mt-2 text-sm text-forest-2 tabular-nums">{note}</dd>}
    </div>
  )
}

/** Clean / compensated: the rep's own mark (open circle or terracotta diamond) and a word, never colour alone. */
export function ResultTag({ compensated, className }: { compensated: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-bold whitespace-nowrap', compensated ? 'text-terra-deep' : 'text-forest', className)}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0"><Mark cx={7} cy={7} r={4.4} compensated={compensated} /></svg>
      {compensated ? 'Compensated' : 'Clean'}
    </span>
  )
}

/** The mark for one rep in a chart: clean = open circle, compensated = filled terracotta diamond. */
export function Mark({ cx, cy, compensated, r = 5, emphasis }: {
  cx: number
  cy: number
  compensated: boolean
  r?: number
  emphasis?: boolean
}) {
  if (compensated) {
    const s = r + 1.6
    return <path d={`M${cx},${cy - s}L${cx + s},${cy}L${cx},${cy + s}L${cx - s},${cy}Z`} fill="var(--color-terra)"
      stroke={emphasis ? 'var(--color-forest)' : 'var(--color-panel)'} strokeWidth={emphasis ? 2 : 1.2} />
  }
  return <circle cx={cx} cy={cy} r={r} fill="var(--color-panel)" stroke="var(--color-forest)" strokeWidth={emphasis ? 2.6 : 1.8} />
}

export function Legend({ threshold, className }: { threshold: number; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-forest-2', className)}>
      <span className="inline-flex items-center gap-1.5">
        <svg className="size-3.5" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="5" fill="none" stroke="var(--color-forest)" strokeWidth="1.8" /></svg>
        Clean rep
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg className="size-3.5" viewBox="0 0 14 14" aria-hidden><path d="M7 0.5L13.5 7L7 13.5L0.5 7Z" fill="var(--color-terra)" /></svg>
        Compensated rep
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg className="h-3.5 w-6" viewBox="0 0 24 14" aria-hidden><line x1="0" x2="24" y1="7" y2="7" stroke="var(--color-forest)" strokeDasharray="6 5" strokeWidth="1.5" /></svg>
        Limit <span className="font-readout tabular-nums">{threshold}°</span>
      </span>
    </div>
  )
}

export interface Option {
  value: string
  label: ReactNode
}

/** Accessible dropdown (Radix Select). */
export function Select({ label, value, onChange, options, className, triggerClassName }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
  triggerClassName?: string
}) {
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-10 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-wall bg-panel px-3 text-[15px] text-forest',
          'transition-colors duration-150 hover:border-forest-2/60',
          FOCUS, className, triggerClassName,
        )}
      >
        <span className="truncate"><RSelect.Value /></span>
        <RSelect.Icon><ChevronDown className="size-4 text-forest-2" aria-hidden /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg border border-wall bg-panel font-text text-forest shadow-[0_2px_4px_rgb(31_45_39/0.08),0_14px_32px_-18px_rgb(31_45_39/0.5)]"
        >
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer items-center rounded-md py-2 pr-9 pl-3 text-[15px] outline-none select-none data-highlighted:bg-wash"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-eucalyptus" aria-hidden />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

/** A row of mutually exclusive buttons (e.g. which measure a chart shows). */
export function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; short?: string }[]
}) {
  return (
    <div role="group" aria-label={label}
      className="grid w-full rounded-lg border border-wall bg-panel p-0.5 sm:inline-grid sm:w-auto"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, auto))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 cursor-pointer rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
            value === o.value ? 'bg-forest text-plaster' : 'text-forest-2 hover:bg-wash hover:text-forest',
            FOCUS,
          )}
        >
          {o.short ? <><span className="sm:hidden">{o.short}</span><span className="hidden sm:inline">{o.label}</span></> : o.label}
        </button>
      ))}
    </div>
  )
}

/** A plain bordered button. */
export function Button({ children, onClick, label, disabled, className, primary }: {
  children: ReactNode
  onClick: () => void
  label?: string
  disabled?: boolean
  className?: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px',
        primary ? 'bg-forest text-plaster hover:bg-forest-deep' : 'border border-wall bg-panel text-forest hover:bg-wash',
        FOCUS, className,
      )}
    >
      {children}
    </button>
  )
}

/**
  A fixed-height box that hands its measured width to a chart. Used instead of
  Recharts' ResponsiveContainer, which can measure 0 during a resize and draw nothing.
*/
export function ChartBox({ height, className, children }: {
  height: number
  className?: string
  children: (width: number, height: number) => ReactNode
}) {
  const [ref, w] = useWidth<HTMLDivElement>(0)
  return (
    <div ref={ref} className={cn('w-full min-w-0', className)} style={{ height }}>
      {w > 0 && children(w, height)}
    </div>
  )
}

/** The readout plate's face, the landing page's instrument at working size: plaster, 14px corners, the Plate hang shadow. */
export const PLATE = 'relative flex min-w-0 flex-col items-start rounded-[14px] border-[1.5px] bg-plaster px-3 pt-3 pb-2.5 text-left shadow-[0_2px_4px_rgb(31_45_39/0.08),0_14px_32px_-18px_rgb(31_45_39/0.5)] sm:px-5 sm:pt-4 sm:pb-3'

/** A value with its unit raised and smaller, as on the landing page's readout plate. */
export function PlateValue({ text }: { text: string }) {
  const m = /^(−?[\d.]+)\s?(.*)$/.exec(text)
  if (!m) return <>{text}</>
  return <>{m[1]}{m[2] && <span className="ml-0.5 align-[0.55em] text-[0.55em]">{m[2]}</span>}</>
}

/*
  A row of figures in one container, split by hairlines (no card per figure, no
  shadow): label over a Mono value with its unit raised, and a short note under it.
  The gaps between cells are the hairlines: the container is wall, the cells panel.
*/
export interface Figure { label: string; short?: string; value: string; note?: ReactNode; noteClass?: string; tone?: 'comp' }
export function FigureStrip({ items, className, label }: { items: Figure[]; className?: string; label?: string }) {
  return (
    <dl aria-label={label} className={cn('grid gap-px overflow-hidden rounded-xl border border-wall bg-wall', className)}>
      {items.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col bg-panel px-4 pt-3 pb-3.5 sm:px-5 sm:pt-4 sm:pb-4">
          <dt className="text-[13px] leading-snug font-bold whitespace-nowrap text-forest-2 sm:text-sm">
            {f.short ? <><span className="sm:hidden">{f.short}</span><span className="hidden sm:inline">{f.label}</span></> : f.label}
          </dt>
          <dd className={cn('mt-1.5 font-readout text-[1.6rem] leading-none tracking-[-0.02em] whitespace-nowrap tabular-nums sm:text-[1.85rem]', f.tone === 'comp' && 'text-terra')}>
            <PlateValue text={f.value} />
          </dd>
          {f.note && <dd className={cn('mt-2 text-[13px] leading-snug text-pretty tabular-nums sm:text-sm', f.noteClass ?? 'text-forest-2')}>{f.note}</dd>}
        </div>
      ))}
    </dl>
  )
}
