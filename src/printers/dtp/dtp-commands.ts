import type {
	AbrirCfArgs,
	ItemCfArgs,
	PagoCfArgs,
} from "./dtp-printer.types.js";

/**
 * Comandos para impresora fiscal DTP-80i.
 * Cada comando se ejecuta secuencialmente contra un DtpClient.
 */
export type DtpPrinterCommand =
	| { cmd: "F0"; data: AbrirCfArgs }
	| { cmd: "F1"; data: ItemCfArgs }
	| {
			cmd: "F2";
			data: { mode?: number; foreignCurrencyAmount?: number };
	  }
	| { cmd: "F4"; data: PagoCfArgs }
	| { cmd: "F5"; data?: { additionalLine?: string } }
	| {
			cmd: "F11";
			data: {
				iFormaPago: number;
				sDescripcion: string;
				lMonto: number;
				lTasaCambio: number;
				sSimbolo: string;
			};
	  }
	| { cmd: "N0" }
	| {
			cmd: "N1";
			data: {
				line: string;
				size?: number;
				align?: number;
				style?: number;
			};
	  }
	| { cmd: "N3" };
