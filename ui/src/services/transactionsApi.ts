import type { Transaction } from "../pages/transactions/TransactionsShell";

const API_BASE = "/api/transactions";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function listTransactions() {
  return json<Transaction[]>(
    await fetch(`${API_BASE}`, { method: "GET" })
  );
}
