import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, UserRound } from "lucide-react";
import { decryptData } from "@phoebe/crypto";
import { client } from "../api";
import { useEncryptionKey } from "../context/KeyContext";

type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
};

type EncryptedRecord = {
  id: string;
  familyMemberId: string;
  encryptedData: string;
  iv: string;
  createdAt: string;
};

type DecryptedRecord = EncryptedRecord & {
  plainText?: string;
  decryptError?: string;
};

export default function ViewRecordsPage() {
  const { key, ready } = useEncryptionKey();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [records, setRecords] = useState<DecryptedRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await client.api["family-members"].$get();
        if (!res.ok) {
          throw new Error("Failed to load family members");
        }
        const data = await res.json();
        if (!cancelled) {
          setMembers(data.members);
          if (data.members.length > 0) {
            setSelectedMemberId(data.members[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load family members");
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMemberId || !ready || !key) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingRecords(true);
      setError(null);

      try {
        const res = await client.api["family-members"][":id"]["medical-records"].$get({
          param: { id: selectedMemberId },
        });

        if (!res.ok) {
          throw new Error("Failed to load medical records");
        }

        const data = await res.json();
        const encryptedRecords = data.records as EncryptedRecord[];

        const decrypted = await Promise.all(
          encryptedRecords.map(async (record) => {
            try {
              const plainText = await decryptData(
                { encryptedData: record.encryptedData, iv: record.iv },
                key
              );
              return { ...record, plainText };
            } catch {
              return {
                ...record,
                decryptError: "Could not decrypt with the current session key.",
              };
            }
          })
        );

        if (!cancelled) {
          setRecords(decrypted);
        }
      } catch (err) {
        if (!cancelled) {
          setRecords([]);
          setError(err instanceof Error ? err.message : "Failed to load medical records");
        }
      } finally {
        if (!cancelled) {
          setLoadingRecords(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMemberId, key, ready]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-teal-700">Family records</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          View medical records
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a family member to load and decrypt their vault entries locally.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Family members
          </h3>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <ul className="space-y-1">
              {members.map((member) => {
                const active = member.id === selectedMemberId;
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        active
                          ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200"
                          : "text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{member.name}</span>
                        <span className="block text-xs text-slate-500">{member.relationship}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              {selectedMember ? selectedMember.name : "Select a member"}
            </h3>
            <p className="text-sm text-slate-500">
              {selectedMember
                ? `${selectedMember.relationship} · decrypted on this device only`
                : "Choose someone from the list"}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingRecords ? (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading and decrypting records…
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              No medical records yet for this family member.
            </div>
          ) : (
            <ul className="space-y-3">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Record
                    </p>
                    <time className="text-xs text-slate-500" dateTime={record.createdAt}>
                      {new Date(record.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {record.decryptError ? (
                    <div className="flex items-start gap-2 text-sm text-amber-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{record.decryptError}</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                      {record.plainText}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
