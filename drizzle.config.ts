import { existsSync } from "node:fs";
import process from "node:process";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) {
	process.loadEnvFile(".env.local");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/infra/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	schemaFilter: ["app"],
	casing: "snake_case",
});
