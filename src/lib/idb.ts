// IndexedDB wrapper for offline-first persistence of settings & boards.
import { openDB, type IDBPDatabase } from "idb";
import type { BoardData } from "./types";

const DB_NAME = "gesture-wb";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
        if (!db.objectStoreNames.contains("boards")) db.createObjectStore("boards");
        if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export async function idbGet<T>(store: "settings" | "boards" | "queue", key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(store, key) as Promise<T | undefined>;
}

export async function idbSet<T>(store: "settings" | "boards" | "queue", key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put(store, value, key);
}

export async function idbDel(store: "settings" | "boards" | "queue", key: string) {
  const db = await getDB();
  await db.delete(store, key);
}

export async function saveLocalBoard(id: string, board: BoardData) {
  await idbSet("boards", id, { ...board, savedAt: Date.now() });
}

export async function loadLocalBoard(id: string): Promise<BoardData | undefined> {
  return idbGet<BoardData>("boards", id);
}

export async function enqueueOp(op: { type: string; payload: unknown; ts: number }) {
  const db = await getDB();
  await db.add("queue", op);
}

export async function drainQueue(): Promise<unknown[]> {
  const db = await getDB();
  const all = await db.getAll("queue");
  await db.clear("queue");
  return all;
}
