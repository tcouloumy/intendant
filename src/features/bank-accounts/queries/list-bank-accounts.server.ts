import { eq } from "drizzle-orm";
import { db } from "@/infra/db/index.server";
import { bankAccountsTable } from "@/infra/db/schema";

export async function listBankAccountsQuery(householdId: string) {
	return db
		.select({
			id: bankAccountsTable.id,
			name: bankAccountsTable.name,
		})
		.from(bankAccountsTable)
		.where(eq(bankAccountsTable.householdId, householdId));
}
