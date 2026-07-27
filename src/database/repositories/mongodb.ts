// StorageDeckAPI/src/database/mongodb.ts
import { MongoClient, Db } from "mongodb";
import { env } from "../../config/env";

let db: Db;

export async function connectMongoDB(): Promise<Db> {
  if (db) {
    return db;
  }

  const client = new MongoClient(env.MONGODB_URI);

  await client.connect();

  db = client.db(env.MONGODB_DATABASE);

  console.log("\n✅ Connected to MongoDB");

  return db;
}