type Props = {
  title: string
  description: string
  steps: string[]
}

export function ProgressPageGuide({ title, description, steps }: Props) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
        How To Use This Page
      </p>
      <p className="mt-2 text-base font-semibold text-sky-950 dark:text-sky-100">{title}</p>
      <p className="mt-1 text-sm text-sky-900/80 dark:text-sky-100/80">{description}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={`${index}-${step}`}
            className="rounded-xl border border-sky-200/70 bg-white/70 p-3 text-sm text-sky-950 dark:border-sky-900/40 dark:bg-slate-950/40 dark:text-sky-50"
          >
            <span className="font-semibold text-sky-700 dark:text-sky-300">{index + 1}.</span>{" "}
            {step}
          </div>
        ))}
      </div>
    </div>
  )
}
