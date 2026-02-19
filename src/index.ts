/**
 * cafe-ipdh-lib
 * Librería para gestionar impresoras fiscales y de recibos.
 *
 * Soporta:
 * - AEG-R1: impresora fiscal vía HTTP (comandos JSON)
 *
 * Uso:
 * ```ts
 * import { aegPrinter } from "cafe-ipdh-lib";
 *
 * const commands = aegPrinter.buildInvoiceCommands(order, {
 *   paymentMethodId: "pos_credit",
 *   storeName: "Mi Tienda"
 * });
 * // Enviar commands a la impresora vía tu API/transport
 * ```
 */

export { DtpClient } from "./printers/dtp/dtp-client";
export type {
	BuildCreditNoteOptions,
	BuildInvoiceOptions,
	BuildReceiptOptions,
	CreateDtpConnection,
	DocumentType,
	DtpOptions,
	DtpPrinterCommand,
	DtpSocketLike,
	ExecuteDtpCommandsResult,
	PrinterCommandResponse,
	PrinterDriver,
} from "./printers/index";
export {
	aegPrinter,
	dtpPrinter,
} from "./printers/index";
export { sendPrinterCommands } from "./runner/index";
export type {
	AegModel,
	DtpModel,
	PrinterBrand,
	SendPrinterCommandsAeg,
	SendPrinterCommandsArgs,
	SendPrinterCommandsDtp,
	SendPrinterCommandsResult,
} from "./runner/index.js";
export type {
	AegPrinterCommand,
	FiscalClient,
	ItemTax,
	Order,
	OrderItem,
	OrderPayment,
} from "./types/index.js";
export {
	PaymentMethodId,
	PrinterTaxValues,
	TaxValues,
} from "./types/index.js";
