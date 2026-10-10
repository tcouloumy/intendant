import {
	index,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { app } from "./app";

export const importsTable = app.table(
	"imports",
	{
		id: uuid().primaryKey().defaultRandom(),
		householdId: uuid().notNull(),
		bankAccountId: uuid().notNull().unique("imports_bank_account_id_unique"),
		fileName: varchar({ length: 256 }).notNull(),
		fileSha256: text().notNull(),
		error: text(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("imports_bank_account_id_file_sha256_unique").on(
			t.bankAccountId,
			t.fileSha256,
		),
	],
);
