import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
export * from "./schema";

const client = createClient({
	url: process.env.DATABASE_URL || "file:./codeatlas.db",
});

export const db = drizzle({ client });
