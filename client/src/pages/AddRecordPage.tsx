import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { encryptData } from "@phoebe/crypto";
import { client } from "../api";
import { useEncryptionKey } from "../context/KeyContext";

type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
};

export default function AddRecordPage() {
  const { key, ready } = useEncryptionKey();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyMemberId, setFamilyMemberId] = useState("");
  const [note, setNote] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
            setFamilyMemberId(data.members[0].id);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!key || !ready) {
      setError("Encryption key is not ready yet.");
      return;
    }
    if (!familyMemberId) {
      setError("Select a family member.");
      return;
    }
    if (!note.trim()) {
      setError("Enter a medical note before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const encrypted = await encryptData(note.trim(), key);
      const res = await client.api["medical-records"].$post({
        json: {
          familyMemberId,
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body && typeof body === "object" && "error" in body
            ? String((body as { error: string }).error)
            : "Failed to save medical record"
        );
      }

      setNote("");
      setSuccess("Encrypted record saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medical record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-medium text-teal-700">Default view</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Add medical record
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Notes are encrypted in your browser before they leave the device.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="family-member" className="mb-1.5 block text-sm font-medium text-slate-700">
            Family member
          </label>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading members…
            </div>
          ) : (
            <select
              id="family-member"
              value={familyMemberId}
              onChange={(e) => setFamilyMemberId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.relationship})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-slate-700">
            Medical note
          </label>
          <textarea
            id="note"
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Allergy notes, medication changes, visit summary…"
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || loadingMembers || !ready}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Encrypt & Save
        </button>
      </form>
    </div>
  );
}
