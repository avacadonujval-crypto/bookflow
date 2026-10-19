export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-neutral-300 bg-neutral-50/80 px-6 py-12 text-center">
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="type-small mt-2 max-w-md">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
