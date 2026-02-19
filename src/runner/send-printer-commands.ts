import { executeDtpCommands } from "../printers/dtp/dtp-printer-driver";
import type {
	PrinterCommandResponse,
	SendPrinterCommandsAeg,
	SendPrinterCommandsArgs,
	SendPrinterCommandsDtp,
	SendPrinterCommandsResult,
} from "./types";

function normalizeBaseUrl(address: string): string {
	const trimmed = address.trim();
	if (!trimmed) return trimmed;
	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `http://${trimmed}`;
	return withProtocol.replace(/\/+$/, "");
}

/**
 * Envía comandos a una impresora fiscal.
 *
 * - **AEG-R1**: POST HTTP a {ip}/cmdoJson con body = commands (JSON)
 * - **DTP-80i**: Ejecuta comandos contra un DtpClient ya conectado por TCP
 */
export async function sendPrinterCommands(
	args: SendPrinterCommandsArgs,
	options?: { timeout?: number },
): Promise<SendPrinterCommandsResult> {
	const { brand, model, commands } = args;

	if (!commands || commands.length === 0) {
		throw new Error("No hay comandos para enviar");
	}

	switch (brand) {
		case "AEG":
			if (model !== "R1") {
				throw new Error(
					`Modelo inválido para AEG: "${model}". Solo se soporta "R1".`,
				);
			}
			return sendAegCommands(args as SendPrinterCommandsAeg, options);
		case "DTP":
			if (model !== "80i") {
				throw new Error(
					`Modelo inválido para DTP: "${model}". Solo se soporta "80i".`,
				);
			}
			return sendDtpCommands(args as SendPrinterCommandsDtp);
		default: {
			const _exhaustive: never = brand;
			throw new Error(
				`Marca de impresora no soportada: ${String(_exhaustive)}`,
			);
		}
	}
}

async function sendDtpCommands(
	args: SendPrinterCommandsDtp,
): Promise<SendPrinterCommandsResult> {
	const { client, commands } = args;
	return executeDtpCommands(client, commands);
}

async function sendAegCommands(
	args: SendPrinterCommandsAeg,
	options?: { timeout?: number },
): Promise<PrinterCommandResponse[]> {
	const { ip, commands } = args;
	const baseUrl = normalizeBaseUrl(ip);
	const url = `${baseUrl}/cmdoJson`;
	const controller = new AbortController();
	const timeoutId =
		options?.timeout != null
			? setTimeout(() => controller.abort(), options.timeout)
			: undefined;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(commands),
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
		}

		const data = (await response.json()) as unknown;

		if (!Array.isArray(data)) {
			throw new Error(
				`Respuesta inválida de la impresora: se esperaba un array, se recibió ${typeof data}`,
			);
		}

		const result = data as PrinterCommandResponse[];

		const failedCommands: PrinterCommandResponse[] = [];
		for (const commandResponse of result) {
			const codeValue =
				typeof commandResponse.code === "string"
					? Number.parseInt(commandResponse.code, 10)
					: commandResponse.code;

			if (Number.isNaN(codeValue) || codeValue !== 0) {
				failedCommands.push(commandResponse);
			}
		}

		if (failedCommands.length > 0) {
			const errorMessages = failedCommands
				.map(
					(cmd) =>
						`Comando ${cmd.cmd}: código ${cmd.code}${cmd.message ? ` - ${cmd.message}` : ""}`,
				)
				.join("; ");
			throw new Error(
				`Error en la impresora: ${failedCommands.length} comando(s) fallaron. ${errorMessages}`,
			);
		}

		return result;
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				throw new Error("Timeout al enviar comandos a la impresora");
			}
			throw error;
		}
		throw new Error("Error desconocido al enviar comandos a la impresora");
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}
