import { NavLink, Outlet } from "react-router-dom";
import { FilePlus2, FolderOpen, ShieldCheck } from "lucide-react";
import { useEncryptionKey } from "../context/KeyContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
    isActive
      ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");

export default function Layout() {
  const { keyExported, ready, error } = useEncryptionKey();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">Phoebe</h1>
                <p className="text-xs text-slate-500">Medical Vault</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            <NavLink to="/" end className={navLinkClass}>
              <FilePlus2 className="h-4 w-4" />
              Add Record
            </NavLink>
            <NavLink to="/records" className={navLinkClass}>
              <FolderOpen className="h-4 w-4" />
              View Records
            </NavLink>
          </nav>

          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Session key
            </p>
            {!ready ? (
              <p className="text-xs text-slate-500">Initializing…</p>
            ) : error ? (
              <p className="text-xs text-rose-600">{error}</p>
            ) : (
              <p className="break-all font-mono text-[10px] leading-relaxed text-slate-600">
                {keyExported || "—"}
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              Zero-knowledge: only this browser holds the decryption key.
            </p>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 sm:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
