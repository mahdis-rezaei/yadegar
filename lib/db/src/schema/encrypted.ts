import { customType } from "drizzle-orm/pg-core";
import { encrypt, decrypt } from "../crypto";

// A text column whose value is transparently encrypted on write and decrypted
// on read. To the database it's a plain `text` column (ciphertext); to the app
// it's a normal string. Swap `text(...)` → `encryptedText(...)` to protect a
// column with zero changes to the routes that read/write it.
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value: string): string {
    return encrypt(value);
  },
  fromDriver(value: string): string {
    return decrypt(value);
  },
});
