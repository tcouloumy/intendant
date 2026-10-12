import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../infra/auth/auth.functions";
import { listBankAccounts } from "./queries/list-bank-accounts.server";

export const getBankaccounts = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(({ context }) => {
		return listBankAccounts(context.session.householdId);
	});
