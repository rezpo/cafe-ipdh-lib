export { aegPrinter } from "./aeg/aeg-printer.js";
export {
	dtpPrinter,
	executeDtpCommands,
} from "./dtp/dtp-printer-driver.js";
export type {
	DtpPrinterDriver,
	ExecuteDtpCommandsResult,
} from "./dtp/dtp-printer-driver.js";
export type { DtpPrinterCommand } from "./dtp/dtp-commands.js";
export type { CreateDtpConnection, DtpSocketLike } from "./dtp/dtp-transport.types.js";
export type { DtpOptions } from "./dtp/dtp-client.js";
export type {
	BuildCreditNoteFromInvoiceOptions,
	BuildCreditNoteOptions,
	BuildInvoiceOptions,
	BuildReceiptOptions,
	DocumentType,
	PrinterCommandResponse,
	PrinterDriver,
} from "./printer.types.js";
