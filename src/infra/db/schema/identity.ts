import {
	index,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { app } from "./app";

export const householdMemberRole = app.enum("household_member_role", [
	"owner",
	"member",
]);

export const householdsTable = app.table("households", {
	id: uuid().primaryKey().defaultRandom(),
	name: varchar({ length: 64 }).notNull(),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = app.table("users", {
	id: uuid().primaryKey().defaultRandom(),
	authSubject: text().notNull().unique("users_auth_subject_unique"),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const householdMembersTable = app.table(
	"household_members",
	{
		id: uuid().primaryKey().defaultRandom(),
		householdId: uuid()
			.references(() => householdsTable.id, { onDelete: "cascade" })
			.notNull(),
		userId: uuid()
			.references(() => usersTable.id, { onDelete: "cascade" })
			.notNull(),
		role: householdMemberRole().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("household_members_user_id_idx").on(t.userId),
		unique("household_members_household_id_user_id_unique").on(
			t.householdId,
			t.userId,
		),
	],
);
