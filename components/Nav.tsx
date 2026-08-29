import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          PayGate <span className="text-emerald-600">B2B</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/" className="text-zinc-600 hover:text-zinc-900">
            Solicitudes
          </Link>
          <Link
            href="/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
          >
            + Nueva solicitud
          </Link>
        </nav>
      </div>
    </header>
  );
}
