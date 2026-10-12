import process from "node:process";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.server";
import { householdMembersTable, usersTable } from "../db/schema";

export type Session = { userId: string; householdId: string };

// stub, everyone is signed in as the seeded dev user. The real provider
// replaces this subject with the one from the request's session; signatures stay.
// Must match scripts/seed.ts.
const DEV_AUTH_SUBJECT = "dev-user";

export async function getSession(): Promise<Session | null> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("The auth stub must never run in production");
	}

	const userId = await findOrCreateUser(DEV_AUTH_SUBJECT);

	// first membership wins. Several households per user is an open question (ADR 0004)
	const [membership] = await db
		.select({ householdId: householdMembersTable.householdId })
		.from(householdMembersTable)
		.where(eq(householdMembersTable.userId, userId))
		.orderBy(asc(householdMembersTable.createdAt))
		.limit(1);

	if (!membership) {
		throw new Error(`${DEV_AUTH_SUBJECT} has no household: run pnpm db:seed`);
	}

	return { userId, householdId: membership.householdId };
}

export async function requireUser(): Promise<Session> {
	const session = await getSession();

	if (!session) {
		throw new Error("Unauthorized");
	}

	return session;
}

// Users are created on first sign-in (ADR 0003). Read first, so a known user costs no write.
async function findOrCreateUser(authSubject: string) {
	const find = () =>
		db
			.select({ id: usersTable.id })
			.from(usersTable)
			.where(eq(usersTable.authSubject, authSubject));

	const [existing] = await find();

	if (existing) {
		return existing.id;
	}

	// Two first requests can race: ignore the conflict and read back the winner.
	await db.insert(usersTable).values({ authSubject }).onConflictDoNothing();

	const [created] = await find();

	return created.id;
}
