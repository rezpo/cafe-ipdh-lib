import { describe, expect, it } from "vitest";
import type { DtpClient } from "../printers/dtp/dtp-client";
import { sendPrinterCommands } from "./send-printer-commands";

describe("sendPrinterCommands", () => {
	it("valida brand+model AEG+R1", async () => {
		await expect(
			sendPrinterCommands({
				brand: "AEG",
				model: "invalid" as "R1",
				ip: "http://192.168.1.1",
				commands: [{ cmd: "encDNF", data: ["T", "1"] }],
			}),
		).rejects.toThrow("Modelo inválido para AEG");
	});

	it("DTP delega en executeDtpCommands y propaga el error del cliente", async () => {
		const mockClient = {
			send: async () => {
				throw new Error("socket not connected");
			},
		} as unknown as DtpClient;

		await expect(
			sendPrinterCommands({
				brand: "DTP",
				model: "80i",
				client: mockClient,
				commands: [
					{ cmd: "F0", data: { sNombreCliente: "X", sRifCliente: "" } },
				],
			}),
		).rejects.toThrow("socket not connected");
	});

	it("rechaza comandos vacíos", async () => {
		await expect(
			sendPrinterCommands({
				brand: "AEG",
				model: "R1",
				ip: "http://localhost",
				commands: [],
			}),
		).rejects.toThrow("No hay comandos para enviar");
	});

	it("rechaza brand desconocido (exhaustive)", async () => {
		await expect(
			sendPrinterCommands({
				brand: "UNKNOWN" as "AEG",
				model: "R1",
				ip: "http://localhost",
				commands: [{ cmd: "encDNF", data: ["T", "1"] }],
			}),
		).rejects.toThrow("no soportada");
	});
});
