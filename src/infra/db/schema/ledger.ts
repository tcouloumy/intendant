import { sql } from "drizzle-orm";
import {
	bigint,
	char,
	check,
	date,
	foreignKey,
	index,
	smallint,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { app } from "./app";
import { householdsTable } from "./identity";

export const categorizationSource = app.enum("categorization_source", [
	"llm",
	"user",
]);

export const bankAccountsTable = app.table(
	"bank_accounts",
	{
		id: uuid().primaryKey().defaultRandom(),
		householdId: uuid()
			.references(() => householdsTable.id, { onDelete: "cascade" })
			.notNull(),
		name: varchar({ length: 64 }).notNull(),
		accountNumber: varchar({ length: 34 }),
		currency: char({ length: 3 }).notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("bank_accounts_household_id_name_unique").on(t.householdId, t.name),
		unique("bank_accounts_household_id_account_number_unique").on(
			t.householdId,
			t.accountNumber,
		),
		check(
			"bank_accounts_account_number_check",
			sql`${t.accountNumber} ~ '^[A-Z0-9]+$'`,
		),
		// Target of the composite FKs that keep children in the same household.
		unique("bank_accounts_id_household_id_unique").on(t.id, t.householdId),
		check("bank_accounts_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
	],
);

export const categoriesTable = app.table(
	"categories",
	{
		id: uuid().primaryKey().defaultRandom(),
		householdId: uuid()
			.references(() => householdsTable.id, { onDelete: "cascade" })
			.notNull(),
		name: varchar({ length: 64 }).notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("categories_household_id_name_unique").on(t.householdId, t.name),
		unique("categories_id_household_id_unique").on(t.id, t.householdId),
	],
);

export const transactionsTable = app.table(
	"transactions",
	{
		id: uuid().primaryKey().defaultRandom(),
		householdId: uuid().notNull(),
		bankAccountId: uuid().notNull(),
		// String mode: a booking day is not an instant, a JS Date would shift it.
		bookedOn: date({ mode: "string" }).notNull(),
		label: text().notNull(),
		labelNormalized: text().notNull(),
		// Signed minor units: negative = debit.
		amountMinor: bigint({ mode: "number" }).notNull(),
		currency: char({ length: 3 }).notNull(),
		// Numbers identical rows within one export, so they survive dedupe.
		occurrence: smallint().notNull().default(1),
		categoryId: uuid(),
		categorizedBy: categorizationSource(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "transactions_bank_account_fk",
			columns: [t.bankAccountId, t.householdId],
			foreignColumns: [bankAccountsTable.id, bankAccountsTable.householdId],
		}).onDelete("cascade"),
		// No action: deleting a category in use must fail until its transactions are moved.
		foreignKey({
			name: "transactions_category_fk",
			columns: [t.categoryId, t.householdId],
			foreignColumns: [categoriesTable.id, categoriesTable.householdId],
		}),
		unique("transactions_dedupe_key").on(
			t.bankAccountId,
			t.bookedOn,
			t.amountMinor,
			t.labelNormalized,
			t.occurrence,
		),
		index("transactions_household_id_booked_on_idx").on(
			t.householdId,
			t.bookedOn,
		),
		check("transactions_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
		check(
			"transactions_categorized_check",
			sql`(${t.categoryId} is null) = (${t.categorizedBy} is null)`,
		),
		check("transactions_occurrence_check", sql`${t.occurrence} >= 1`),
	],
);
