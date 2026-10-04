import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Dashboard });

const placeholders = [
	{ title: "Balance", description: "All accounts" },
	{ title: "Spending", description: "This month" },
	{ title: "To review", description: "Uncategorized transactions" },
];

function Dashboard() {
	return (
		<main className="mx-auto max-w-5xl space-y-6 p-6">
			<header className="flex items-center justify-between">
				<h1 className="font-heading text-2xl font-semibold">Intendant</h1>
				<Button disabled>Import CSV</Button>
			</header>
			<section className="grid gap-4 sm:grid-cols-3">
				{placeholders.map((p) => (
					<Card key={p.title}>
						<CardHeader>
							<CardTitle>{p.title}</CardTitle>
							<CardDescription>{p.description}</CardDescription>
						</CardHeader>
						<CardContent className="text-3xl font-semibold text-muted-foreground">
							—
						</CardContent>
					</Card>
				))}
			</section>
		</main>
	);
}
