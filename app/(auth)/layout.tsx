export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Recomp</h1>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
