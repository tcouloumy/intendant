import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creditAgricoleParser as parser } from "./credit-agricole";
import { decode } from "./parser";

// The bank's export, and the same rows re-saved by an editor (UTF-8, ";;;;" padding, narrow NBSP).
const original = readFileSync("fixtures/credit-agricole.csv");
const resaved = readFileSync("fixtures/credit-agricole-resaved-utf8.csv");

const expected = [
	[
		"2026-03-31",
		"Paiement par carte X0000 FAUXMARCHE PARIS 30/03 - Fauxmarché",
		-4217,
	],
	[
		"2026-03-31",
		"Virement en votre faveur VIR INST de ACME SAS - 0326 Salaire JEAN DUPONT",
		234567,
	],
	[
		"2026-03-30",
		"Prélèvement 0000000 ELECTRICITE DE NULLE PART - ECHEANCE 03/2026 CONTRAT N° 0000",
		-6130,
	],
	[
		"2026-03-30",
		"Paiement par carte X0000 BOULANGERIE DU COIN 29/03 - Boulangerie",
		-320,
	],
	[
		"2026-03-30",
		"Paiement par carte X0000 BOULANGERIE DU COIN 29/03 - Boulangerie",
		-320,
	],
	[
		"2026-03-28",
		"Retrait au distributeur X0000 PARIS 27/03 10H42 - Retrait d'espèces",
		-6000,
	],
	["2026-03-27", "Virement émis VIR INST vers JEAN DUPONT; épargne", -100000],
	["2026-03-26", "Prélèvement FAUXOPERATEUR - FAUXOPERATEUR Prlvt SEPA", -1999],
	["2026-03-25", "Virement en votre faveur CPAM 00", 850],
	["2026-03-02", "Avoir carte X0000 FAUXMARCHE PARIS 01/03 - Fauxmarché", 1240],
].map(([bookedOn, label, amountMinor]) => ({ bookedOn, label, amountMinor }));

// Physical line where each record starts (multi-line labels span several lines).
const expectedLines = [12, 18, 24, 26, 32, 38, 44, 50, 56, 58];

const row = (debit: string, credit: string, date = "01/03/2026") => ({
	Date: date,
	Libellé: "Paiement par carte\nX0000 TEST",
	"Débit euros": debit,
	"Crédit euros": credit,
});

describe("decode", () => {
	it("reads Windows-1252 and UTF-8 the same", () => {
		expect(decode(original)).toContain(
			"Date;Libellé;Débit euros;Crédit euros;",
		);
		expect(decode(resaved)).toContain("Date;Libellé;Débit euros;Crédit euros;");
	});

	it("reads UTF-16 with a BOM, both byte orders", () => {
		const le = Buffer.concat([
			Buffer.from([0xff, 0xfe]),
			Buffer.from("Libellé", "utf16le"),
		]);
		const be = Buffer.from(le).swap16();
		expect(decode(le)).toBe("Libellé");
		expect(decode(be)).toBe("Libellé");
	});

	it("strips a UTF-8 BOM", () => {
		expect(decode(Buffer.from("﻿Date"))).toBe("Date");
	});
});

describe("creditAgricoleParser.parse", () => {
	it("reads the account number from the preamble", () => {
		expect(parser.parse(original).accountNumber).toBe("00000000001");
	});

	it("keeps raw cells as-is, keyed by the bank's headers", () => {
		const { rows } = parser.parse(original);
		expect(rows[0].raw).toEqual({
			Date: "31/03/2026",
			Libellé:
				"Paiement par carte\nX0000 FAUXMARCHE PARIS  30/03 - Fauxmarché\n\n\n\n",
			"Débit euros": "42,17",
			"Crédit euros": "",
		});
	});

	it("numbers rows by the line they start on, skipping blank records", () => {
		expect(parser.parse(original).rows.map((r) => r.lineNumber)).toEqual(
			expectedLines,
		);
		expect(parser.parse(resaved).rows.map((r) => r.lineNumber)).toEqual(
			expectedLines,
		);
	});

	it("rejects a file without the header", () => {
		expect(() => parser.parse(Buffer.from("foo;bar\n1;2\n"))).toThrow();
		expect(() => parser.parse(Buffer.from(""))).toThrow();
	});
});

describe("creditAgricoleParser.normalize", () => {
	it("normalizes the fixture", () => {
		expect(
			parser.parse(original).rows.map((r) => parser.normalize(r.raw)),
		).toEqual(expected);
	});

	it("normalizes a re-saved export to the same transactions", () => {
		expect(
			parser.parse(resaved).rows.map((r) => parser.normalize(r.raw)),
		).toEqual(expected);
	});

	it.each([
		["5", 500],
		["12", 1200],
		["12,5", 1250],
		["0,99", 99],
		["1 234,56", 123456],
		["1\u00a0234,56", 123456],
		["1\u202f234,56", 123456],
	])("reads amount %j as %i minor units", (amount, minor) => {
		expect(parser.normalize(row(amount, "")).amountMinor).toBe(-minor);
		expect(parser.normalize(row("", amount)).amountMinor).toBe(minor);
	});

	it.each([
		"12,345",
		"1.234,56",
		"12.50",
		"-5,00",
		"abc",
		"12,",
	])("rejects amount %j", (amount) => {
		expect(() => parser.normalize(row(amount, ""))).toThrow();
	});

	it("rejects rows with both or neither amounts", () => {
		expect(() => parser.normalize(row("1,00", "1,00"))).toThrow();
		expect(() => parser.normalize(row("", ""))).toThrow();
		expect(() => parser.normalize(row("0,00", "5,00"))).toThrow();
	});

	it.each([
		"31/02/2026",
		"2026-03-01",
		"1/3/2026",
		"00/03/2026",
		"01/13/2026",
	])("rejects date %j", (date) => {
		expect(() => parser.normalize(row("1,00", "", date))).toThrow();
	});

	it("accepts a leap day", () => {
		expect(parser.normalize(row("1,00", "", "29/02/2028")).bookedOn).toBe(
			"2028-02-29",
		);
	});

	it("rejects an empty label", () => {
		expect(() =>
			parser.normalize({ ...row("1,00", ""), Libellé: " \n\n " }),
		).toThrow();
	});
});
