import { createMiddleware } from "@tanstack/react-start";
import { requireUser } from "./index.server";

export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => next({ context: { session: await requireUser() } }),
);
