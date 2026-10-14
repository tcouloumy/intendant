import { type InfoRecord, parse } from "csv-parse/sync";
import { decode, type Parser } from "./parser";

const HEADER = ["Date", "Libellé", "Débit euros", "Crédit euros"];

export const creditAgricoleParser: Parser = {
	id: "credit_agricole_v1",

	parse: (bytes) => {
		const decodedText = decode(bytes);
		const data = parse(decodedText, {
			delimiter: ";",
			relax_column_count: true,
			info: true,
		}) as unknown as {
			// csv-parse types don't model info: true
			record: string[];
			info: InfoRecord;
		}[];

		const headerIndex = data.findIndex(({ record }) =>
			HEADER.every((name, i) => record[i] === name),
		);
		if (headerIndex === -1)
			throw new Error("Header not found, incorrect file format");

		const records = data
			.filter(({ record }, i) => {
				return i > headerIndex && !record.every((elt) => !elt);
			})
			.map(({ record, info }) => {
				const physicalLine =
					info.lines - record.join("").split("\n").length + 1;
				const raw = Object.fromEntries(
					HEADER.map((name, i) => [name, record[i] ?? ""]),
				);

				return {
					lineNumber: physicalLine,
					raw,
				};
			});

		return {
			accountNumber:
				data
					.slice(0, headerIndex)
					.map(({ record }) => record.join(";"))
					.join("\n")
					.match(/n°\s*(\d+)/)?.[1] ?? null,
			rows: records,
		};
	},
	normalize: (row: Record<string, string>) => {
		return { label: "", amountMinor: 0, bookedOn: "" };
	},
};
