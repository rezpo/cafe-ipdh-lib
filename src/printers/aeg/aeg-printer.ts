import type { AegPrinterCommand } from "../../types/aeg-commands.js";
import {
	PaymentMethodId,
	PrinterTaxValues,
	TaxValues,
} from "../../types/enums.js";
import type { Order } from "../../types/order.js";
import type {
	BuildInvoiceOptions,
	BuildReceiptOptions,
	PrinterDriver,
} from "../printer.types.js";

function truncateString(str: string, maxLength = 64): string {
	if (!str) return "";
	return str.length > maxLength ? str.substring(0, maxLength) : str;
}

// biome-ignore lint: avoid control char in literal
const ISO_8859_1_REGEX = new RegExp("[^\\u0000-\\u00FF]", "g");

function normalizeIso88591(str: string): string {
	return str.replace(ISO_8859_1_REGEX, "?");
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

function mapTaxIdToPrinterCode(taxId: string | null | undefined): number {
	if (!taxId) {
		return PrinterTaxValues.EXENTO_E;
	}
	const taxIdUpper = taxId.toUpperCase();
	const printerTaxValue =
		PrinterTaxValues[taxIdUpper as keyof typeof PrinterTaxValues];
	if (printerTaxValue !== undefined) {
		return printerTaxValue;
	}
	return PrinterTaxValues.EXENTO_E;
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

/**
 * Driver para impresora fiscal AEG-R1.
 * Construye comandos JSON según documentación oficial.
 */
export const aegPrinter: PrinterDriver<AegPrinterCommand> = {
	model: "aeg-r1",

	buildInvoiceCommands(
		order: Order,
		options: BuildInvoiceOptions,
	): AegPrinterCommand[] {
		const commands: AegPrinterCommand[] = [];

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

		// 1. cliF - Datos del cliente
		const clientRifCI = order.client.id || "";
		const clientName = order.client.name || "";
		const clientEmail = order.client.email || "";
		const clientPhone = order.client.phone || "";
		const clientAddress = order.client.address || "";
		const razSoc = [clientName, clientEmail, clientPhone]
			.filter(Boolean)
			.map((v) => truncateString(v, 64));
		const storeLine = `Tienda: ${storeName}`;
		const LineAd = [storeLine, clientAddress]
			.filter(Boolean)
			.map((v) => truncateString(v, 64));

		commands.push({
			cmd: "cliF",
			data: { rifCI: clientRifCI, razSoc, LineAd },
		});

		// 2. proF - Productos
		let subtotalWithoutTaxes = 0;

		for (const item of order.items) {
			if (!item.name) continue;

			const taxId =
				item.taxes && item.taxes.length > 0 ? item.taxes[0].id : null;
			const imp = mapTaxIdToPrinterCode(taxId);
			const price = item.price || 0;
			const pre = Math.round(Math.max(price, 0) * 100);
			const quantity = item.selectedQuantity ?? item.quantity ?? 1;
			const cant = Math.round(Math.max(quantity, 1) * 1000);
			const des01 = truncateString(item.name, 64);

			subtotalWithoutTaxes += price * Math.max(quantity, 1);

			commands.push({
				cmd: "proF",
				data: { imp, pre, cant, des01 },
			});
		}

		// 2.1 IGTF si pago en divisas
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
				cmd: "proF",
				data: {
					imp: PrinterTaxValues.PERCIBIDO,
					pre: Math.round(igtfAmount * 100),
					cant: 1000,
					des01: "IGTF 3% pago en divisas",
				},
			});
		}

		// 3. subToF - Subtotal
		commands.push({ cmd: "subToF", data: 1, valor: 0 });

		// 4. fpaF - Forma de pago
		if (!order.payments?.length) {
			throw new Error("Order debe tener al menos un pago exitoso");
		}

		for (const payment of order.payments) {
			const paymentType = mapPaymentMethod(payment.paymentMethod);
			const paymentAmount = Math.round(payment.amount * 100);
			commands.push({
				cmd: "fpaF",
				data: {
					tipo: paymentType,
					monto: paymentAmount,
					tasaConv: 0,
				},
			});
		}

		// 5. endFac - Cierre
		commands.push({ cmd: "endFac", data: 1 });

		return commands;
	},

	buildReceiptCommands(options: BuildReceiptOptions): AegPrinterCommand[] {
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
		const amountLabel = `Bs ${amountPaid}`;
		const paymentLabel = `Medio de pago: ${paymentMethod}`;
		const dateLabel = `Fecha del pago: ${formatDate(paidDate)}`;
		const timeLabel = `Hora del pago: ${formatTime(paidDate)}`;
		const cardLabel = `Tarjeta ${cardLast4 ?? "N/A"}`;
		const orgLabel = organizationName?.trim() || "N/A";

		return [
			{
				cmd: "encDNF",
				data: [
					normalizeIso88591(truncateString("RECIBO DE PAGO")),
					normalizeIso88591(truncateString(orderId)),
				],
			},
			{
				cmd: "aperDNF",
				data: normalizeIso88591(truncateString("Recibo de pago")),
			},
			{
				cmd: "efeNorJuIzDNF",
				data: normalizeIso88591(truncateString(orgLabel)),
			},
			{
				cmd: "efeNorJuIzDNF",
				data: normalizeIso88591(truncateString(amountLabel)),
			},
			{
				cmd: "efeNorJuIzDNF",
				data: normalizeIso88591(truncateString(paymentLabel)),
			},
			{
				cmd: "efeNorJuIzDNF",
				data: normalizeIso88591(truncateString(cardLabel)),
			},
			{
				cmd: "efeNorJuIzDNF",
				data: normalizeIso88591(truncateString(timeLabel)),
			},
			{
				cmd: "efeNorJuIzDNF",
				data: normalizeIso88591(truncateString(dateLabel)),
			},
			{
				cmd: "endDNF",
				data: normalizeIso88591("Cierre del Documento No Fiscal"),
			},
		];
	},
};
