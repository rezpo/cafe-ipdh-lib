import type { ExecuteDtpCommandsResult } from "../printers/dtp/dtp-printer-driver.js";
import type { DtpPrinterCommand } from "../printers/dtp/dtp-commands.js";
import type { DtpClient } from "../printers/dtp/dtp-client.js";
import type { AegPrinterCommand } from "../types/aeg-commands.js";

/**
 * Marcas de impresoras soportadas.
 */
export type PrinterBrand = "AEG" | "DTP";

/**
 * Modelos por marca.
 * AEG: R1 (impresora fiscal HTTP)
 * DTP: 80i (impresora fiscal TCP)
 */
export type AegModel = "R1";
export type DtpModel = "80i";

/**
 * Argumentos para AEG-R1.
 * Usa comandos JSON sobre HTTP POST a /cmdoJson.
 */
export interface SendPrinterCommandsAeg {
	brand: "AEG";
	model: AegModel;
	ip: string;
	commands: AegPrinterCommand[];
}

/**
 * Argumentos para DTP-80i.
 * Requiere un DtpClient ya conectado por TCP (creado con createNodeDtpConnection
 * o el socket de React Native según el entorno).
 */
export interface SendPrinterCommandsDtp {
	brand: "DTP";
	model: DtpModel;
	client: DtpClient;
	commands: DtpPrinterCommand[];
}

/**
 * Argumentos de sendPrinterCommands.
 * Discriminados por brand para validar model.
 */
export type SendPrinterCommandsArgs =
	| SendPrinterCommandsAeg
	| SendPrinterCommandsDtp;

/**
 * Respuesta de un comando de impresora.
 */
export interface PrinterCommandResponse {
	cmd: string;
	code: number;
	dataD?: number;
	dataS?: Record<string, unknown>;
	message?: string;
}

export type PrinterResponse = PrinterCommandResponse[];

/**
 * Resultado unificado de sendPrinterCommands.
 * - AEG: array de respuestas por comando.
 * - DTP: objeto con documentNumber y totalAmount cuando se cierra factura/nota de crédito.
 */
export type SendPrinterCommandsResult =
	| PrinterCommandResponse[]
	| ExecuteDtpCommandsResult;
