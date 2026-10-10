CREATE TYPE "app"."import_row_status" AS ENUM('pending', 'imported', 'duplicate', 'error');--> statement-breakpoint
CREATE TYPE "app"."import_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "app"."categorization_source" AS ENUM('llm', 'user');--> statement-breakpoint
CREATE TYPE "app"."currency" AS ENUM('EUR');--> statement-breakpoint
CREATE TABLE "app"."import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"status" "app"."import_row_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_rows_import_id_line_number_unique" UNIQUE("import_id","line_number")
);
--> statement-breakpoint
CREATE TABLE "app"."imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"storage_key" text NOT NULL,
	"file_name" varchar(256) NOT NULL,
	"file_sha256" text NOT NULL,
	"parser" text NOT NULL,
	"status" "app"."import_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imports_bank_account_id_file_sha256_unique" UNIQUE("bank_account_id","file_sha256"),
	CONSTRAINT "imports_id_household_id_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
CREATE TABLE "app"."bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"account_number" varchar(34),
	"currency" "app"."currency" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_household_id_name_unique" UNIQUE("household_id","name"),
	CONSTRAINT "bank_accounts_household_id_account_number_unique" UNIQUE("household_id","account_number"),
	CONSTRAINT "bank_accounts_id_household_id_unique" UNIQUE("id","household_id"),
	CONSTRAINT "bank_accounts_id_household_id_currency_unique" UNIQUE("id","household_id","currency"),
	CONSTRAINT "bank_accounts_account_number_check" CHECK ("app"."bank_accounts"."account_number" ~ '^[A-Z0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "app"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_household_id_name_unique" UNIQUE("household_id","name"),
	CONSTRAINT "categories_id_household_id_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
CREATE TABLE "app"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"booked_on" date NOT NULL,
	"label" text NOT NULL,
	"label_normalized" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "app"."currency" NOT NULL,
	"occurrence" smallint DEFAULT 1 NOT NULL,
	"category_id" uuid,
	"categorized_by" "app"."categorization_source",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_dedupe_key" UNIQUE("bank_account_id","booked_on","amount_minor","label_normalized","occurrence"),
	CONSTRAINT "transactions_categorized_check" CHECK (("app"."transactions"."category_id" is null) = ("app"."transactions"."categorized_by" is null)),
	CONSTRAINT "transactions_occurrence_check" CHECK ("app"."transactions"."occurrence" >= 1)
);
--> statement-breakpoint
ALTER TABLE "app"."import_rows" ADD CONSTRAINT "import_rows_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "app"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_rows" ADD CONSTRAINT "import_rows_import_fk" FOREIGN KEY ("import_id","household_id") REFERENCES "app"."imports"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."imports" ADD CONSTRAINT "imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."imports" ADD CONSTRAINT "imports_bank_account_fk" FOREIGN KEY ("bank_account_id","household_id") REFERENCES "app"."bank_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bank_accounts" ADD CONSTRAINT "bank_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_bank_account_fk" FOREIGN KEY ("bank_account_id","household_id","currency") REFERENCES "app"."bank_accounts"("id","household_id","currency") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_category_fk" FOREIGN KEY ("category_id","household_id") REFERENCES "app"."categories"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_rows_transaction_id_idx" ON "app"."import_rows" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transactions_household_id_booked_on_idx" ON "app"."transactions" USING btree ("household_id","booked_on");