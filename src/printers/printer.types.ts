import type { Order } from "../types/order.js";

/**
 * Tipo de documento a imprimir.
 */
export type DocumentType = "invoice" | "receipt" | "credit_note";

/**
 * Resultado de envío de comandos a una impresora.
 */
export interface PrinterCommandResponse {
	cmd: string;
	code: number;
	dataD?: number;
	dataS?: Record<string, unknown>;
	message?: string;
}

/**
 * Opciones para construir comandos de factura.
 */
export interface BuildInvoiceOptions {
	paymentMethodId:
		| "pos_credit"
		| "pos_debit"
		| "pos_debit_credit_int"
		| "cash_int"
		| "cash_nat";
	storeName?: string;
}

/**
 * Opciones para construir comandos de nota de crédito.
 */
export interface BuildCreditNoteOptions {
	/** Número de la factura original que se está anulando. */
	referenceInvoiceNumber: number;
	/** Fecha de la factura original. */
	referenceInvoiceDate: Date;
	/** Serial fiscal de la factura original (opcional). */
	referenceInvoiceSerial?: string;
	paymentMethodId:
		| "pos_credit"
		| "pos_debit"
		| "pos_debit_credit_int"
		| "cash_int"
		| "cash_nat";
	storeName?: string;
}

/**
 * Opciones para construir comandos de recibo de pago.
 */
export interface BuildReceiptOptions {
	orderId: string;
	amountPaid: number;
	paymentMethod: string;
	organizationName?: string;
	paidAt?: Date;
	cardLast4?: string | null;
}

/**
 * Interface abstracta para un driver de impresora.
 * Cada modelo (AEG-R1, DTP, etc.) implementa esta interface.
 */
export interface PrinterDriver<TCmd = unknown> {
	readonly model: string;

	/**
	 * Construye comandos para imprimir una factura fiscal.
	 */
	buildInvoiceCommands(order: Order, options: BuildInvoiceOptions): TCmd[];

	/**
	 * Construye comandos para imprimir un recibo de pago (DNF).
	 */
	buildReceiptCommands(options: BuildReceiptOptions): TCmd[];

	/**
	 * Construye comandos para imprimir una nota de crédito fiscal (opcional).
	 */
	buildCreditNoteCommands?(
		order: Order,
		options: BuildCreditNoteOptions,
	): TCmd[];
}
