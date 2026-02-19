import type { DtpClient } from "./dtp-client";
import type { AbrirCfArgs, ItemCfArgs, PagoCfArgs } from "./dtp-printer.types";

const formatDateDDMMYYYY = (d: Date) => {
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = String(d.getFullYear());
	return `${dd}${mm}${yyyy}`;
};

function parseCode(r: string[], idx = 0): number {
	const v = r[idx];
	const n = Number(v);
	return v !== undefined && v !== null && !Number.isNaN(n) ? n : 16;
}

// C0 Get Status (used as "real ping")
export async function getStatus(client: DtpClient) {
	const r = await client.send(["C0"]);
	const code = parseCode(r);
	return {
		code,
		state: code === 0 && r.length > 2 ? Number(r[2] ?? -1) : -1,
		block: code === 0 && r.length > 3 ? Number(r[3] ?? -1) : -1,
		fiscalStatus: code === 0 && r.length > 4 ? String(r[4] ?? "") : "",
		lastCommandResponse:
			code === 0 && r.length > 5 ? Number(r[5] ?? -1) : -1,
		raw: r,
	};
}

export async function openFiscalDoc(client: DtpClient, args: AbrirCfArgs) {
	const r = await client.send([
		"F0",
		String(args.iTipo ?? 0),
		args.sNombreCliente,
		args.sRifCliente,
		String(args.iFacturaReferencia ?? 0),
		formatDateDDMMYYYY(args.fechaReferencia ?? new Date()),
		args.sSerialReferencia ?? "",
		(args.bLogo ?? false) ? "1" : "0",
		args.sLineaAdicional ?? "",
	]);
	return {
		code: parseCode(r),
		documentNumber: Number(r[1] ?? -1),
		raw: r,
	};
}

export async function addFiscalItem(client: DtpClient, args: ItemCfArgs) {
	const r = await client.send([
		"F1",
		String(args.iTipo ?? 0),
		args.sDescripcion,
		args.sCodigo,
		String(args.lCantidad),
		args.sUnidad,
		String(args.lPrecio),
		String(args.iImpuesto),
		String(args.iDecPrecio),
		String(args.iDecCantidad),
	]);
	return {
		code: parseCode(r),
		itemCount: Number(r[1] ?? -1),
		totalItem: Number(r[2] ?? -1),
		printedLines: Number(r[3] ?? -1),
		raw: r,
	};
}

export async function subtotalFiscalDoc(
	client: DtpClient,
	mode = 0,
	foreignCurrencyAmount = 0,
) {
	const r = await client.send([
		"F2",
		String(mode),
		String(foreignCurrencyAmount),
	]);
	return { code: parseCode(r), raw: r };
}

export async function payFiscalDoc(client: DtpClient, args: PagoCfArgs) {
	const r = await client.send([
		"F4",
		String(args.iTipoPago ?? 0),
		String(args.iFormaPago),
		args.sDescripcion,
		String(args.lMonto),
	]);
	return {
		code: parseCode(r),
		amountDue: Number(r[1] ?? -1),
		changeAmount: Number(r[2] ?? -1),
		printedLines: Number(r[3] ?? -1),
		raw: r,
	};
}

export async function addFiscalComment(
	client: DtpClient,
	comment: string,
	size = 0,
	align = 0,
	style = 0,
) {
	const r = await client.send([
		"F7",
		comment,
		String(size),
		String(align),
		String(style),
	]);
	return {
		code: parseCode(r),
		printedLines: Number(r[1] ?? -1),
		raw: r,
	};
}

export async function closeFiscalDoc(
	client: DtpClient,
	additionalLine = "",
) {
	const r = await client.send(["F5", additionalLine]);
	return {
		code: parseCode(r),
		documentNumber: Number(r[1] ?? -1),
		totalAmount: Number(r[2] ?? -1),
		raw: r,
	};
}

export async function cancelFiscalDoc(client: DtpClient) {
	const r = await client.send(["F6"]);
	return { code: parseCode(r), raw: r };
}

export async function getSerializationData(client: DtpClient) {
	const r = await client.send(["C2"]);
	const code = parseCode(r);
	return {
		code,
		fiscalSerial: code === 0 && r.length >= 2 ? r[1] : "",
		printerSerial: code === 0 && r.length >= 3 ? r[2] : "",
		kitSerial: code === 0 && r.length >= 4 ? r[3] : "",
		mfSerial: code === 0 && r.length >= 5 ? r[4] : "",
		maSerial: code === 0 && r.length >= 6 ? r[5] : "",
		raw: r,
	};
}

export async function getFiscalizationData(client: DtpClient) {
	const r = await client.send(["C3"]);
	const code = parseCode(r);
	return {
		code,
		taxpayerName: code === 0 && r.length >= 2 ? r[1] : "",
		fiscalAddress: code === 0 && r.length >= 3 ? r[2] : "",
		taxpayerRif: code === 0 && r.length >= 4 ? r[3] : "",
		commercialName: code === 0 && r.length >= 5 ? r[4] : "",
		distributorName: code === 0 && r.length >= 6 ? r[5] : "",
		distributorRif: code === 0 && r.length >= 7 ? r[6] : "",
		taxRate1: code === 0 && r.length >= 8 ? Number(r[7]) : 0,
		taxRate2: code === 0 && r.length >= 9 ? Number(r[8]) : 0,
		taxRate3: code === 0 && r.length >= 10 ? Number(r[9]) : 0,
		taxRate4: code === 0 && r.length >= 11 ? Number(r[10]) : 0,
		raw: r,
	};
}

export async function getPaymentMethod(
	client: DtpClient,
	paymentMethodId: number,
) {
	const r = await client.send(["C9", String(paymentMethodId)]);
	return {
		code: parseCode(r),
		name: parseCode(r) === 0 && r.length >= 2 ? r[1] : "",
		raw: r,
	};
}

export async function setPaymentMethod(
	client: DtpClient,
	paymentMethodId: number,
	name: string,
) {
	const r = await client.send(["C10", String(paymentMethodId), name]);
	return { code: parseCode(r), raw: r };
}

export async function payFiscalDocForeignCurrency(
	client: DtpClient,
	args: {
		iFormaPago: number;
		sDescripcion: string;
		lMonto: number;
		lTasaCambio: number;
		sSimbolo: string;
	},
) {
	const r = await client.send([
		"F11",
		"0",
		args.sDescripcion,
		String(args.lMonto),
		String(args.lTasaCambio),
		args.sSimbolo,
		String(args.iFormaPago),
	]);
	return {
		code: parseCode(r),
		amountDue: Number(r[1] ?? -1),
		changeAmount: Number(r[2] ?? -1),
		printedLines: Number(r[3] ?? -1),
		raw: r,
	};
}

export async function reportX(
	client: DtpClient,
	noOpenDrawer = false,
) {
	const parts = ["R0", "0"];
	if (noOpenDrawer) parts.push("1");
	const r = await client.send(parts);
	const code = parseCode(r);
	return {
		code,
		documentNumber: code === 0 && r.length >= 2 ? Number(r[1]) : -1,
		raw: r,
	};
}

export async function reportZ(
	client: DtpClient,
	noOpenDrawer = false,
) {
	const parts = ["R0", "1"];
	if (noOpenDrawer) parts.push("1");
	const r = await client.send(parts);
	const code = parseCode(r);
	return {
		code,
		reportNumber: code === 0 && r.length >= 2 ? Number(r[1]) : -1,
		raw: r,
	};
}

export async function getFiscalDayInfo(client: DtpClient) {
	const r = await client.send(["R1"]);
	const code = parseCode(r);
	if (code !== 0 || r.length < 84) {
		return { code, raw: r };
	}
	return {
		code,
		zNumber: Number(r[1]),
		zDate: r[2],
		zTime: r[3],
		zStartDate: r[4],
		zStartTime: r[5],
		lastInvoiceNumber: Number(r[67]),
		lastInvoiceDate: r[68],
		lastInvoiceTime: r[69],
		lastCreditNoteNumber: Number(r[71]),
		lastDebitNoteNumber: Number(r[75]),
		raw: r,
	};
}

export async function getCounters(client: DtpClient) {
	const r = await client.send(["R9"]);
	const code = parseCode(r);
	return {
		code,
		lastInvoice: code === 0 && r.length >= 2 ? Number(r[1]) : -1,
		lastVoidedInvoice: code === 0 && r.length >= 3 ? Number(r[2]) : -1,
		lastCreditNote: code === 0 && r.length >= 4 ? Number(r[3]) : -1,
		lastDebitNote: code === 0 && r.length >= 5 ? Number(r[4]) : -1,
		lastNonFiscal: code === 0 && r.length >= 6 ? Number(r[5]) : -1,
		lastZReport: code === 0 && r.length >= 7 ? Number(r[6]) : -1,
		raw: r,
	};
}

export async function searchReprint(
	client: DtpClient,
	documentType: number,
	documentNumber: number,
	print = true,
) {
	const r = await client.send([
		"R8",
		print ? "1" : "0",
		String(documentType),
		String(documentNumber),
	]);
	return { code: parseCode(r), raw: r };
}

export async function startFiscalMemoryReportByDateRange(
	client: DtpClient,
	reportType: number,
	startDate: Date,
	endDate: Date,
) {
	const r = await client.send([
		"R2",
		"0",
		String(reportType),
		formatDateDDMMYYYY(startDate),
		formatDateDDMMYYYY(endDate),
	]);
	return {
		code: parseCode(r),
		recordCount: parseCode(r) === 0 && r.length >= 2 ? Number(r[1]) : -1,
		raw: r,
	};
}

export async function getFiscalMemoryReportData(client: DtpClient) {
	const r = await client.send(["R3"]);
	return { code: parseCode(r), raw: r };
}

export async function finishFiscalMemoryReport(client: DtpClient) {
	const r = await client.send(["R4"]);
	return { code: parseCode(r), raw: r };
}

export async function openNonFiscalDoc(client: DtpClient) {
	const r = await client.send(["N0"]);
	return { code: parseCode(r), raw: r };
}

export async function addNonFiscalLine(
	client: DtpClient,
	line: string,
	size = 0,
	align = 0,
	style = 0,
) {
	const r = await client.send([
		"N1",
		line,
		String(size),
		String(align),
		String(style),
	]);
	return {
		code: parseCode(r),
		printedLines: parseCode(r) === 0 && r.length >= 2 ? Number(r[1]) : -1,
		raw: r,
	};
}

export async function closeNonFiscalDoc(client: DtpClient) {
	const r = await client.send(["N3"]);
	return {
		code: parseCode(r),
		documentNumber: parseCode(r) === 0 && r.length >= 2 ? Number(r[1]) : -1,
		raw: r,
	};
}
