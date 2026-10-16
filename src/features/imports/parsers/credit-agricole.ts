import { type InfoRecord, parse as parseCSV } from "csv-parse/sync";
import { format, isValid, parse } from "date-fns";
import { decode, type Parser } from "./parser";

const HEADER = ["Date", "Libellé", "Débit euros", "Crédit euros"];

const parseAmountToCents = (amount: string) => {
	const trimmedAmount = amount.replace(/\s/g, "");

	if (!trimmedAmount) {
		return null;
	}

	const match = trimmedAmount.match(/^(\d+)(?:,(\d{1,2}))?$/);

	if (!match) {
		throw new Error(`Invalid amount: ${amount}`);
	}

	const [, euros, cents = ""] = match;

	return Number(euros) * 100 + Number(cents.padEnd(2, "0"));
};

const signedAmount = (debit: number | null, credit: number | null) => {
	if (debit !== null && credit === null) {
		return -debit;
	}

	if (credit !== null && debit === null) {
		return credit;
	}

	throw new Error("Expected exactly one of debit or credit");
};

const parseDate = (date: string) => {
	if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
		throw new Error(`Invalid date: ${date}`);
	}

	const parsedDate = parse(date, "dd/MM/yyyy", new Date());

	if (!isValid(parsedDate)) {
		throw new Error(`Invalid date: ${date}`);
	}

	return format(parsedDate, "yyyy-MM-dd");
};

export const creditAgricoleParser: Parser = {
	id: "credit_agricole_v1",

	parse: (bytes) => {
		const decodedText = decode(bytes);
		// csv-parse types don't model info: true
		const data = parseCSV(decodedText, {
			delimiter: ";",
			relax_column_count: true,
			info: true,
		}) as unknown as {
			record: string[];
			info: InfoRecord;
		}[];

		const headerIndex = data.findIndex(({ record }) =>
			HEADER.every((name, i) => record[i] === name),
		);

		if (headerIndex === -1) {
			throw new Error("Header not found, incorrect file format");
		}

		const rows = data
			.slice(headerIndex + 1)
			.filter(({ record }) => record.some(Boolean))
			.map(({ record, info }) => ({
				lineNumber: info.lines - record.join("").split("\n").length + 1,
				raw: Object.fromEntries(
					HEADER.map((name, i) => [name, record[i] ?? ""]),
				),
			}));

		return {
			accountNumber:
				data
					.slice(0, headerIndex)
					.map(({ record }) => record.join(";"))
					.join("\n")
					.match(/n°\s*(\d+)/)?.[1] ?? null,
			rows,
		};
	},
	normalize: (row) => {
		const label = row.Libellé.replace(/\s+/g, " ").trim();

		if (!label) {
			throw new Error("Empty label");
		}

		return {
			label,
			amountMinor: signedAmount(
				parseAmountToCents(row["Débit euros"]),
				parseAmountToCents(row["Crédit euros"]),
			),
			bookedOn: parseDate(row.Date),
		};
	},
};
