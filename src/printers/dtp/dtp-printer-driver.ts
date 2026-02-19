import {
	PaymentMethodId,
	PrinterTaxValues,
	TaxValues,
} from "../../types/enums.js";
import type { Order } from "../../types/order.js";
import type {
	BuildCreditNoteOptions,
	BuildInvoiceOptions,
	BuildReceiptOptions,
	PrinterDriver,
} from "../printer.types.js";
import type { DtpClient } from "./dtp-client.js";
import type { DtpPrinterCommand } from "./dtp-commands.js";
import {
	addFiscalItem,
	addNonFiscalLine,
	closeFiscalDoc,
	closeNonFiscalDoc,
	openFiscalDoc,
	openNonFiscalDoc,
	payFiscalDoc,
	payFiscalDocForeignCurrency,
	subtotalFiscalDoc,
} from "./dtp-printer.js";

function truncateString(str: string, maxLength = 64): string {
	if (!str) return "";
	return str.length > maxLength ? str.substring(0, maxLength) : str;
}

function formatDate(date: Date): string {
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();
	return `${day}/${month}/${year}`;
}

function formatTime(date: Date): string {
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Mapea taxId (IVA_G, EXENTO_E, etc.) a código DTP iImpuesto (0..4).
 * DTP: 0=exento, 1=16%, 2=8%, 3=31%, 4=percibido/IGTF.
 */
function mapTaxIdToDtpCode(taxId: string | null | undefined): number {
	if (!taxId) return 0;
	const taxIdUpper = taxId.toUpperCase();
	const aegCode =
		PrinterTaxValues[taxIdUpper as keyof typeof PrinterTaxValues];
	if (aegCode === undefined) return 0;
	const n = Number(aegCode);
	// DTP iImpuesto: 0=exento, 1=16%, 2=8%, 3=31%, 4=percibido
	if (n === PrinterTaxValues.EXENTO_E) return 0;
	if (n === PrinterTaxValues.BI_G || n === PrinterTaxValues.IVA_G)
		return 1;
	if (n === PrinterTaxValues.BI_R || n === PrinterTaxValues.IVA_R)
		return 2;
	if (n === PrinterTaxValues.BI_A || n === PrinterTaxValues.IVA_A)
		return 3;
	if (
		n === PrinterTaxValues.PERCIBIDO ||
		n === PrinterTaxValues.BI_IGTF ||
		n === PrinterTaxValues.IVA_IGTF
	)
		return 4;
	return 0;
}

function mapPaymentMethod(method: string): PaymentMethodId {
	if (method === "pos_debit") return PaymentMethodId.POS_DEBIT;
	if (method === "pos_credit") return PaymentMethodId.POS_CREDIT;
	if (method === "pos_debit_credit_int")
		return PaymentMethodId.POS_DEBIT_CREDIT_INT;
	if (method === "cash_int") return PaymentMethodId.CASH_INT;
	if (method === "cash_nat") return PaymentMethodId.CASH;
	throw new Error(
		`Método de pago inválido: ${method}. Debe ser "pos_debit", "pos_credit", "pos_debit_credit_int", "cash_int" o "cash_nat"`,
	);
}

function paymentMethodLabel(id: PaymentMethodId): string {
	switch (id) {
		case PaymentMethodId.CASH:
			return "EFECTIVO";
		case PaymentMethodId.POS_DEBIT:
			return "TARJETA DEBITO";
		case PaymentMethodId.POS_CREDIT:
			return "TARJETA CREDITO";
		case PaymentMethodId.PAGO_MOVIL:
			return "PAGO MOVIL";
		case PaymentMethodId.POS_DEBIT_CREDIT_INT:
			return "TARJETA INT";
		case PaymentMethodId.CASH_INT:
			return "EFECTIVO USD";
		default:
			return "EFECTIVO";
	}
}

/**
 * Driver para impresora fiscal DTP-80i.
 * Construye comandos DTP compatibles con el protocolo TCP.
 */
export const dtpPrinter: PrinterDriver<DtpPrinterCommand> = {
	model: "dtp-80i",

	buildInvoiceCommands(
		order: Order,
		options: BuildInvoiceOptions,
	): DtpPrinterCommand[] {
		const commands: DtpPrinterCommand[] = [];

		if (!order) {
			throw new Error("Order es requerido");
		}
		if (!order.client) {
			throw new Error("Order debe tener un cliente asociado");
		}
		if (!order.items || order.items.length === 0) {
			throw new Error("Order debe tener al menos un item");
		}

		const { paymentMethodId, storeName = "N/A" } = options;

		const clientName = order.client.name || "";
		const clientRif = order.client.id || "";
		const storeLine = `Tienda: ${storeName}`;

		commands.push({
			cmd: "F0",
			data: {
				sNombreCliente: truncateString(clientName, 64),
				sRifCliente: truncateString(clientRif, 20),
				bLogo: false,
				sLineaAdicional: truncateString(storeLine, 64),
			},
		});

		let subtotalWithoutTaxes = 0;

		for (const item of order.items) {
			if (!item.name) continue;

			const taxId =
				item.taxes && item.taxes.length > 0 ? item.taxes[0].id : null;
			const iImpuesto = mapTaxIdToDtpCode(taxId);
			const price = item.price ?? 0;
			const lPrecio = Math.round(Math.max(price, 0) * 100);
			const quantity = item.selectedQuantity ?? item.quantity ?? 1;
			const lCantidad = Math.round(Math.max(quantity, 1) * 1000);

			subtotalWithoutTaxes += price * Math.max(quantity, 1);

			commands.push({
				cmd: "F1",
				data: {
					sDescripcion: truncateString(item.name, 64),
					sCodigo: truncateString(item.sku ?? "N/A", 20),
					lCantidad,
					sUnidad: "UND",
					lPrecio,
					iImpuesto,
					iDecPrecio: 2,
					iDecCantidad: 3,
				},
			});
		}

		const isForeignCurrency =
			paymentMethodId === "pos_debit_credit_int" ||
			paymentMethodId === "cash_int";

		if (isForeignCurrency && subtotalWithoutTaxes > 0) {
			const roundedSubtotal =
				Math.round((subtotalWithoutTaxes + Number.EPSILON) * 100) / 100;
			const igtfPercentage = TaxValues.BI_IGTF / 100;
			const igtfAmount =
				Math.round((roundedSubtotal * igtfPercentage + Number.EPSILON) * 100) /
				100;

			commands.push({
				cmd: "F1",
				data: {
					sDescripcion: "IGTF 3% pago en divisas",
					sCodigo: "IGTF",
					lCantidad: 1000,
					sUnidad: "UND",
					lPrecio: Math.round(igtfAmount * 100),
					iImpuesto: 4,
					iDecPrecio: 2,
					iDecCantidad: 3,
				},
			});
		}

		commands.push({
			cmd: "F2",
			data: { mode: 1, foreignCurrencyAmount: 0 },
		});

		if (!order.payments?.length) {
			throw new Error("Order debe tener al menos un pago exitoso");
		}

		for (const payment of order.payments) {
			const tipo = mapPaymentMethod(payment.paymentMethod);
			const lMonto = Math.round(payment.amount * 100);
			const isForeign =
				payment.paymentMethod === "pos_debit_credit_int" ||
				payment.paymentMethod === "cash_int";

			if (isForeign) {
				commands.push({
					cmd: "F11",
					data: {
						iFormaPago: tipo,
						sDescripcion: paymentMethodLabel(tipo),
						lMonto,
						lTasaCambio: 1,
						sSimbolo: "USD",
					},
				});
			} else {
				commands.push({
					cmd: "F4",
					data: {
						iFormaPago: tipo,
						sDescripcion: paymentMethodLabel(tipo),
						lMonto,
					},
				});
			}
		}

		commands.push({ cmd: "F5", data: {} });

		return commands;
	},

	buildCreditNoteCommands(
		order: Order,
		options: BuildCreditNoteOptions,
	): DtpPrinterCommand[] {
		const commands: DtpPrinterCommand[] = [];

		if (!order) {
			throw new Error("Order es requerido");
		}
		if (!order.client) {
			throw new Error("Order debe tener un cliente asociado");
		}
		if (!order.items || order.items.length === 0) {
			throw new Error("Order debe tener al menos un item");
		}

		const {
			referenceInvoiceNumber,
			referenceInvoiceDate,
			referenceInvoiceSerial = "",
			paymentMethodId,
			storeName = "N/A",
		} = options;

		const clientName = order.client.name || "";
		const clientRif = order.client.id || "";
		const storeLine = `Tienda: ${storeName}`;

		commands.push({
			cmd: "F0",
			data: {
				iTipo: 1,
				sNombreCliente: truncateString(clientName, 64),
				sRifCliente: truncateString(clientRif, 20),
				iFacturaReferencia: referenceInvoiceNumber,
				fechaReferencia: referenceInvoiceDate,
				sSerialReferencia: truncateString(referenceInvoiceSerial, 20),
				bLogo: false,
				sLineaAdicional: truncateString(storeLine, 64),
			},
		});

		let subtotalWithoutTaxes = 0;

		for (const item of order.items) {
			if (!item.name) continue;

			const taxId =
				item.taxes && item.taxes.length > 0 ? item.taxes[0].id : null;
			const iImpuesto = mapTaxIdToDtpCode(taxId);
			const price = item.price ?? 0;
			const lPrecio = Math.round(Math.max(price, 0) * 100);
			const quantity = item.selectedQuantity ?? item.quantity ?? 1;
			const lCantidad = -Math.round(Math.max(quantity, 1) * 1000);

			subtotalWithoutTaxes += price * Math.max(quantity, 1);

			commands.push({
				cmd: "F1",
				data: {
					iTipo: 1,
					sDescripcion: truncateString(item.name, 64),
					sCodigo: truncateString(item.sku ?? "N/A", 20),
					lCantidad,
					sUnidad: "UND",
					lPrecio,
					iImpuesto,
					iDecPrecio: 2,
					iDecCantidad: 3,
				},
			});
		}

		const isForeignCurrency =
			paymentMethodId === "pos_debit_credit_int" ||
			paymentMethodId === "cash_int";

		if (isForeignCurrency && subtotalWithoutTaxes > 0) {
			const roundedSubtotal =
				Math.round((subtotalWithoutTaxes + Number.EPSILON) * 100) / 100;
			const igtfPercentage = TaxValues.BI_IGTF / 100;
			const igtfAmount =
				Math.round((roundedSubtotal * igtfPercentage + Number.EPSILON) * 100) /
				100;

			commands.push({
				cmd: "F1",
				data: {
					iTipo: 1,
					sDescripcion: "IGTF 3% pago en divisas",
					sCodigo: "IGTF",
					lCantidad: -1000,
					sUnidad: "UND",
					lPrecio: Math.round(igtfAmount * 100),
					iImpuesto: 4,
					iDecPrecio: 2,
					iDecCantidad: 3,
				},
			});
		}

		commands.push({
			cmd: "F2",
			data: { mode: 1, foreignCurrencyAmount: 0 },
		});

		if (!order.payments?.length) {
			throw new Error("Order debe tener al menos un pago exitoso");
		}

		for (const payment of order.payments) {
			const tipo = mapPaymentMethod(payment.paymentMethod);
			const lMonto = Math.round(payment.amount * 100);
			const isForeign =
				payment.paymentMethod === "pos_debit_credit_int" ||
				payment.paymentMethod === "cash_int";

			if (isForeign) {
				commands.push({
					cmd: "F11",
					data: {
						iFormaPago: tipo,
						sDescripcion: paymentMethodLabel(tipo),
						lMonto,
						lTasaCambio: 1,
						sSimbolo: "USD",
					},
				});
			} else {
				commands.push({
					cmd: "F4",
					data: {
						iFormaPago: tipo,
						sDescripcion: paymentMethodLabel(tipo),
						lMonto,
					},
				});
			}
		}

		commands.push({ cmd: "F5", data: {} });

		return commands;
	},

	buildReceiptCommands(options: BuildReceiptOptions): DtpPrinterCommand[] {
		const {
			orderId,
			amountPaid,
			paymentMethod,
			paidAt,
			cardLast4,
			organizationName,
		} = options;

		if (!orderId) {
			throw new Error("OrderId es requerido");
		}
		if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
			throw new Error("Monto pagado inválido");
		}

		const paidDate = paidAt ?? new Date();
		const lines = [
			"RECIBO DE PAGO",
			orderId,
			"Recibo de pago",
			organizationName?.trim() || "N/A",
			`Bs ${amountPaid}`,
			`Medio de pago: ${paymentMethod}`,
			`Tarjeta ${cardLast4 ?? "N/A"}`,
			`Hora del pago: ${formatTime(paidDate)}`,
			`Fecha del pago: ${formatDate(paidDate)}`,
			"Cierre del Documento No Fiscal",
		];

		const commands: DtpPrinterCommand[] = [{ cmd: "N0" }];

		for (const line of lines) {
			commands.push({
				cmd: "N1",
				data: { line: truncateString(line, 64) },
			});
		}

		commands.push({ cmd: "N3" });

		return commands;
	},
};

/**
 * Resultado de ejecutar comandos DTP.
 * Incluye documentNumber y totalAmount cuando el último comando es F5 (cerrar factura).
 */
export interface ExecuteDtpCommandsResult {
	documentNumber?: number;
	totalAmount?: number;
}

/**
 * Ejecuta una secuencia de comandos DTP contra un cliente conectado.
 * Lanza en el primer error.
 * Retorna documentNumber y totalAmount cuando se ejecuta F5 (cerrar factura).
 */
export async function executeDtpCommands(
	client: DtpClient,
	commands: DtpPrinterCommand[],
): Promise<ExecuteDtpCommandsResult> {
	let documentNumber: number | undefined;
	let totalAmount: number | undefined;
	for (const cmd of commands) {
		switch (cmd.cmd) {
			case "F0": {
				const r = await openFiscalDoc(client, cmd.data);
				if (r.code !== 0) throw new Error(`F0 falló: código ${r.code}`);
				break;
			}
			case "F1": {
				const r = await addFiscalItem(client, cmd.data);
				if (r.code !== 0) throw new Error(`F1 falló: código ${r.code}`);
				break;
			}
			case "F2": {
				const r = await subtotalFiscalDoc(
					client,
					cmd.data?.mode ?? 1,
					cmd.data?.foreignCurrencyAmount ?? 0,
				);
				if (r.code !== 0) throw new Error(`F2 falló: código ${r.code}`);
				break;
			}
			case "F4": {
				const r = await payFiscalDoc(client, cmd.data);
				if (r.code !== 0) throw new Error(`F4 falló: código ${r.code}`);
				break;
			}
			case "F5": {
				const r = await closeFiscalDoc(client, cmd.data?.additionalLine ?? "");
				if (r.code !== 0) throw new Error(`F5 falló: código ${r.code}`);
				documentNumber = r.documentNumber;
				totalAmount = r.totalAmount;
				break;
			}
			case "F11": {
				const r = await payFiscalDocForeignCurrency(client, cmd.data);
				if (r.code !== 0)
					throw new Error(`F11 falló: código ${r.code}`);
				break;
			}
			case "N0": {
				const r = await openNonFiscalDoc(client);
				if (r.code !== 0) throw new Error(`N0 falló: código ${r.code}`);
				break;
			}
			case "N1": {
				const r = await addNonFiscalLine(
					client,
					cmd.data.line,
					cmd.data.size ?? 0,
					cmd.data.align ?? 0,
					cmd.data.style ?? 0,
				);
				if (r.code !== 0) throw new Error(`N1 falló: código ${r.code}`);
				break;
			}
			case "N3": {
				const r = await closeNonFiscalDoc(client);
				if (r.code !== 0) throw new Error(`N3 falló: código ${r.code}`);
				break;
			}
			default: {
				const _: never = cmd;
				throw new Error(`Comando DTP desconocido: ${String((cmd as { cmd: string }).cmd)}`);
			}
		}
	}
	return { documentNumber, totalAmount };
}
