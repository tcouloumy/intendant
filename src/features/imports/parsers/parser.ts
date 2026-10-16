export type RawRow = {
	lineNumber: number;
	raw: Record<string, string>;
};

export type ParsedRow = {
	label: string;
	amountMinor: number;
	bookedOn: string;
};

export type Parser = {
	id: string;
	parse: (bytes: Uint8Array) => {
		accountNumber: string | null;
		rows: RawRow[];
	};
	normalize: (row: Record<string, string>) => ParsedRow;
};

export function decode(bytes: Uint8Array) {
	if (bytes[0] === 0xff && bytes[1] === 0xfe) {
		return new TextDecoder("utf-16le").decode(bytes);
	}

	if (bytes[0] === 0xfe && bytes[1] === 0xff) {
		return new TextDecoder("utf-16be").decode(bytes);
	}

	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder("windows-1252").decode(bytes);
	}
}
