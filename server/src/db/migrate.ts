import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { join } from "path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = join(import.meta.dir, "../../drizzle");

const client = postgres(url, { max: 1, ssl: "require" });
const db = drizzle(client);

console.log(`Running migrations from ${migrationsFolder}...`);
await migrate(db, { migrationsFolder });
console.log("Migrations complete");
await client.end();
