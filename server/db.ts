import { PrismaClient } from "@prisma/client";
import { env } from "node:process";
const globalDb = globalThis as unknown as { radarDb?: PrismaClient };
export const db = globalDb.radarDb ?? new PrismaClient();
if (env.NODE_ENV !== "production") globalDb.radarDb = db;
