import { Check, ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react'
import { Select as RSelect } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface shadow-xs', className)}>
      {children}
    </section>
  )
}

export function CardHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-balance">{title}</h3>
        {caption && <p className="mt-0.5 text-sm text-pretty text-ink-3">{caption}</p>}
      </div>
      {right}
    </header>
  )
}

/** Clean / compensated label. Icon + text + colour, so colour never carries the meaning alone. */
export function ResultBadge({ compensated, className }: { compensated: boolean; className?: string }) {
  return compensated ? (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-comp-soft px-2.5 py-1 text-xs font-medium text-[#a8431a]', className)}>
      <TriangleAlert className="size-3.5" aria-hidden />
      Compensated
    </span>
  ) : (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-clean-soft px-2.5 py-1 text-xs font-medium text-[#1d5aa6]', className)}>
      <CircleCheck className="size-3.5" aria-hidden />
      Clean
    </span>
  )
}

export interface Option {
  value: string
  label: ReactNode
}

/** Accessible dropdown (Radix Select). */
export function Select({ label, value, onChange, options, className }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
}) {
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm',
          'hover:border-ink-3/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          className,
        )}
      >
        <span className="truncate"><RSelect.Value /></span>
        <RSelect.Icon><ChevronDown className="size-4 text-ink-3" aria-hidden /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-default items-center rounded-md py-2 pr-8 pl-3 text-sm outline-none select-none data-highlighted:bg-line-2"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-brand" aria-hidden />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

/** Small uppercase-free label above a value. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-ink-3">{children}</p>
}
