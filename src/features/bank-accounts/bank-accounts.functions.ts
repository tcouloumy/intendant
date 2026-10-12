import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../infra/auth/auth.functions";
import { listBankAccountsQuery } from "./queries/list-bank-accounts.server";

export const getBankAccounts = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(({ context }) => {
		return listBankAccountsQuery(context.session.householdId);
	});
