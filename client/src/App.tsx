import { useState, useEffect } from "react";
import { generateKey, encryptData, decryptData, exportKey, importKey, EncryptedPayload } from "@phoebe/crypto";

export default function App() {
  const [recordText, setRecordText] = useState("");
  const [encryptedPayload, setEncryptedPayload] = useState<EncryptedPayload | null>(null);
  const [decryptedText, setDecryptedText] = useState("");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [keyExported, setKeyExported] = useState("");

  useEffect(() => {
    generateKey().then(async (k) => {
      setKey(k);
      const exported = await exportKey(k);
      setKeyExported(exported);
    });
  }, []);

  const handleEncrypt = async () => {
    if (!key || !recordText) return;
    const encrypted = await encryptData(recordText, key);
    setEncryptedPayload(encrypted);
    setDecryptedText("");
  };

  const handleDecrypt = async () => {
    if (!key || !encryptedPayload) return;
    const decrypted = await decryptData(encryptedPayload, key);
    setDecryptedText(decrypted);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800">Phoebe Medical Vault</h1>
        <p className="text-sm text-slate-500">Zero-Knowledge Encrypted Records</p>
      </header>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Client Encryption Key (Raw Base64)</label>
          <input
            type="text"
            readOnly
            value={keyExported}
            className="mt-1 w-full p-2 bg-slate-100 border text-xs font-mono rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Medical Record Note</label>
          <textarea
            className="mt-1 w-full p-2 border rounded"
            rows={3}
            placeholder="Enter sensitive health record..."
            value={recordText}
            onChange={(e) => setRecordText(e.target.value)}
          />
        </div>

        <button
          onClick={handleEncrypt}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Encrypt Client-Side
        </button>

        {encryptedPayload && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-slate-700">Encrypted Payload (sent to server)</h3>
            <div className="p-3 bg-slate-900 text-green-400 font-mono text-xs rounded overflow-x-auto space-y-1">
              <div><span className="text-slate-500">IV:</span> {encryptedPayload.iv}</div>
              <div><span className="text-slate-500">Data:</span> {encryptedPayload.encryptedData}</div>
            </div>

            <button
              onClick={handleDecrypt}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
            >
              Decrypt Locally
            </button>
          </div>
        )}

        {decryptedText && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded">
            <strong>Decrypted Result:</strong> {decryptedText}
          </div>
        )}
      </div>
    </div>
  );
}
