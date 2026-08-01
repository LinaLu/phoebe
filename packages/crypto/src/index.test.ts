import { expect, test } from "bun:test";
import { generateKey, exportKey, importKey, encryptData, decryptData } from "./index";

test("encrypts and decrypts text payload correctly", async () => {
  const key = await generateKey();
  const secretText = "Patient Diagnosis: Mild Fever";

  const encrypted = await encryptData(secretText, key);
  expect(encrypted.encryptedData).not.toEqual(secretText);

  const decrypted = await decryptData(encrypted, key);
  expect(decrypted).toEqual(secretText);
});

test("exports and imports crypto key properly", async () => {
  const key = await generateKey();
  const exported = await exportKey(key);
  const importedKey = await importKey(exported);

  const secretText = "Testing Key Import/Export";
  const encrypted = await encryptData(secretText, importedKey);
  const decrypted = await decryptData(encrypted, key);

  expect(decrypted).toEqual(secretText);
});
