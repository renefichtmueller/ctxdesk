import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// Prisma 7 + SQLite: use BetterSQLite3 adapter
// APP_ROOT verhindert, dass die DB in .next/standalone/ landet (process.cwd() dort ≠ Projektwurzel)
const APP_ROOT = process.env.APP_ROOT ?? process.cwd();
const dbUrl = `file:${path.resolve(APP_ROOT, "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient({ adapter } as any));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
