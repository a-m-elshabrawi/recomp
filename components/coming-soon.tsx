export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        This page is coming in a later stage.
      </p>
    </div>
  );
}
