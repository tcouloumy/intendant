// Resets the app schema and fills it with fake data for local dev. Never real data.
import process from "node:process";
import { sql } from "drizzle-orm";
import { db } from "../src/infra/db/index.server";
import {
	bankAccountsTable,
	categoriesTable,
	householdMembersTable,
	householdsTable,
	transactionsTable,
	usersTable,
} from "../src/infra/db/schema";

// The auth stub signs everyone in as this subject.
const DEV_AUTH_SUBJECT = "dev-user";

// This script truncates everything: refuse anything but a local database.
const { hostname } = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(hostname)) {
	throw new Error(`Refusing to seed a non-local database (${hostname})`);
}

const ACCOUNTS = {
	joint: {
		name: "Joint checking",
		accountNumber: "FR7600000000000000000000001",
	},
	savings: { name: "Livret A", accountNumber: "FR7600000000000000000000002" },
	partner: {
		name: "Partner checking",
		accountNumber: "FR7600000000000000000000003",
	},
};
type Account = keyof typeof ACCOUNTS;

const CATEGORIES = [
	"Income",
	"Housing",
	"Utilities",
	"Groceries",
	"Restaurants",
	"Transport",
	"Subscriptions",
	"Shopping",
	"Pets",
	"Transfers",
] as const;
type Category = (typeof CATEGORIES)[number];

const GROCERS = ["CB CARREFOUR CITY", "CB MONOPRIX", "CB LIDL", "CB PICARD"];
const RESTAURANTS = ["CB LE PETIT CAFE", "CB SUSHI SHOP", "CB PIZZA NAPOLI"];

// mulberry32: tiny seeded PRNG, so amounts are identical on every run.
let state = 42;
function random() {
	state = (state + 0x6d2b79f5) | 0;
	let t = Math.imul(state ^ (state >>> 15), 1 | state);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) =>
	min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[]) =>
	items[Math.floor(random() * items.length)];

// Date.UTC normalizes overflow (month -1, day 0, …), so offsets just work.
const isoDate = (year: number, month: number, day: number) =>
	new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

// placeholder until the CSV parser ticket designs the real normalizer.
const normalizeLabel = (label: string) =>
	label.toUpperCase().replace(/\s+/g, " ").trim();

type Row = {
	account: Account;
	bookedOn: string;
	label: string;
	amountMinor: number;
	category: Category;
};

// Last ~3 months up to today, anchored on the current date so "this month" is never empty.
const now = new Date();
const today = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
const reviewFrom = isoDate(
	now.getFullYear(),
	now.getMonth(),
	now.getDate() - 14,
);
const rows: Row[] = [];

for (const offset of [-2, -1, 0]) {
	const year = now.getFullYear();
	const month = now.getMonth() + offset;
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const add = (
		account: Account,
		day: number,
		label: string,
		amountMinor: number,
		category: Category,
	) => {
		const bookedOn = isoDate(year, month, day);
		if (bookedOn <= today) {
			rows.push({ account, bookedOn, label, amountMinor, category });
		}
	};

	// Fixed monthly flows.
	add("partner", 1, "PRLV SEPA NAVIGO", -8640, "Transport");
	add("partner", 2, "PRLV SEPA BASIC FIT", -2999, "Subscriptions");
	add("joint", 3, "PRLV SEPA FONCIA LOYER", -125000, "Housing");
	add("joint", 5, "VIR VERS LIVRET A", -40000, "Transfers");
	add("savings", 5, "VIR DEPUIS COMPTE JOINT", 40000, "Transfers");
	add("joint", 8, "PRLV SEPA EDF", -between(6500, 9500), "Utilities");
	add("joint", 12, "PRLV SEPA FREE TELECOM", -2999, "Utilities");
	add("joint", 15, "PRLV SEPA NETFLIX.COM", -1349, "Subscriptions");
	// Duplicate subscription: same service, two accounts, different label formats.
	add("joint", 20, "PRLV SEPA SPOTIFY", -1199, "Subscriptions");
	add("partner", 22, "CB SPOTIFY STOCKHOLM", -1199, "Subscriptions");
	add("joint", 28, "VIR SEPA ACME CORP SALAIRE", 320000, "Income");
	add("partner", 28, "VIR SEPA GLOBEX SALAIRE", 260000, "Income");

	// Variable spending.
	for (let day = 1; day <= daysInMonth; day += between(2, 4)) {
		const account = pick(["joint", "joint", "partner"] as const);
		add(account, day, pick(GROCERS), -between(1800, 14000), "Groceries");
	}
	for (let day = between(1, 5); day <= daysInMonth; day += 7) {
		add("joint", day, pick(RESTAURANTS), -between(1500, 6500), "Restaurants");
	}

	// One-offs: outliers, and two identical same-day rows (occurrence 1 and 2).
	if (offset === -2) {
		add("joint", 19, "CB CLINIQUE VETERINAIRE", -34000, "Pets");
	}
	if (offset === -1) {
		add("joint", 16, "CB CAFE KITSUNE", -450, "Restaurants");
		add("joint", 16, "CB CAFE KITSUNE", -450, "Restaurants");
		add("partner", 23, "CB FNAC.COM", -189900, "Shopping");
	}
}

await db.transaction(async (tx) => {
	// Every app table hangs off households or users; Supabase's own schemas are untouched.
	await tx.execute(sql`set local client_min_messages = warning`);
	await tx.execute(sql`truncate app.households, app.users cascade`);

	const [user] = await tx
		.insert(usersTable)
		.values({ authSubject: DEV_AUTH_SUBJECT })
		.returning();
	const [household] = await tx
		.insert(householdsTable)
		.values({ name: "Dev household" })
		.returning();
	await tx.insert(householdMembersTable).values({
		householdId: household.id,
		userId: user.id,
		role: "owner",
	});

	const accounts = await tx
		.insert(bankAccountsTable)
		.values(
			Object.values(ACCOUNTS).map((a) => ({
				...a,
				householdId: household.id,
				currency: "EUR" as const,
			})),
		)
		.returning();
	const accountIdByName = Object.fromEntries(
		accounts.map((a) => [a.name, a.id]),
	);

	const categories = await tx
		.insert(categoriesTable)
		.values(CATEGORIES.map((name) => ({ name, householdId: household.id })))
		.returning();
	const categoryIdByName = Object.fromEntries(
		categories.map((c) => [c.name, c.id]),
	);

	const seen = new Map<string, number>();
	await tx.insert(transactionsTable).values(
		rows.map((r) => {
			const labelNormalized = normalizeLabel(r.label);
			const key = [
				r.account,
				r.bookedOn,
				r.amountMinor,
				labelNormalized,
			].join();
			const occurrence = (seen.get(key) ?? 0) + 1;
			seen.set(key, occurrence);
			// Recent rows stay uncategorized so "To review" has something in it.
			const categorized = r.bookedOn < reviewFrom;
			return {
				householdId: household.id,
				bankAccountId: accountIdByName[ACCOUNTS[r.account].name],
				bookedOn: r.bookedOn,
				label: r.label,
				labelNormalized,
				amountMinor: r.amountMinor,
				currency: "EUR" as const,
				occurrence,
				categoryId: categorized ? categoryIdByName[r.category] : null,
				categorizedBy: categorized ? ("user" as const) : null,
			};
		}),
	);
});

console.log(`Seeded ${rows.length} transactions for ${DEV_AUTH_SUBJECT}.`);

await db.$client.end();
