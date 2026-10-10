import {
	foreignKey,
	integer,
	jsonb,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { app } from "./app";
import { usersTable } from "./identity";
import { bankAccountsTable, transactionsTable } from "./ledger";

export const importStatus = app.enum("import_status", [
	"pending",
	"completed",
	"failed",
]);

export const importRowStatus = app.enum("import_row_status", [
	"pending",
	"imported",
	"duplicate",
	"error",
]);

export const importsTable = app.table(
	"imports",
	{
		id: uuid().primaryKey().defaultRandom(),
		householdId: uuid().notNull(),
		bankAccountId: uuid().notNull(),
		uploadedBy: uuid().references(() => usersTable.id, {
			onDelete: "set null",
		}),
		storageKey: text().notNull(),
		fileName: varchar({ length: 256 }).notNull(),
		fileSha256: text().notNull(),
		// Parser id from the code registry, e.g. "boursorama_v1".
		parser: text().notNull(),
		status: importStatus().notNull().default("pending"),
		error: text(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "imports_bank_account_fk",
			columns: [t.bankAccountId, t.householdId],
			foreignColumns: [bankAccountsTable.id, bankAccountsTable.householdId],
		}).onDelete("cascade"),
		unique("imports_bank_account_id_file_sha256_unique").on(
			t.bankAccountId,
			t.fileSha256,
		),
		unique("imports_id_household_id_unique").on(t.id, t.householdId),
	],
);

export const importRowsTable = app.table(
	"import_rows",
	{
		id: uuid().primaryKey().defaultRandom(),
		importId: uuid().notNull(),
		householdId: uuid().notNull(),
		lineNumber: integer().notNull(),
		raw: jsonb().$type<Record<string, string>>().notNull(),
		status: importRowStatus().notNull().default("pending"),
		error: text(),
		transactionId: uuid().references(() => transactionsTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "import_rows_import_fk",
			columns: [t.importId, t.householdId],
			foreignColumns: [importsTable.id, importsTable.householdId],
		}).onDelete("cascade"),
		unique("import_rows_import_id_line_number_unique").on(
			t.importId,
			t.lineNumber,
		),
	],
);
