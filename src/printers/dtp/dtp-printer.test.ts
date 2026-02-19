import { describe, expect, it, vi } from "vitest";
import type { DtpClient } from "./dtp-client";
import {
	addFiscalComment,
	addFiscalItem,
	addNonFiscalLine,
	cancelFiscalDoc,
	closeFiscalDoc,
	closeNonFiscalDoc,
	getCounters,
	getFiscalizationData,
	getPaymentMethod,
	getSerializationData,
	getStatus,
	openFiscalDoc,
	openNonFiscalDoc,
	payFiscalDoc,
	reportX,
	reportZ,
	setPaymentMethod,
	subtotalFiscalDoc,
} from "./dtp-printer";

function createMockClient(
	responses: Record<string, string[]>,
): DtpClient {
	return {
		send: vi.fn().mockImplementation(async (parts: string[]) => {
			const cmd = parts[0] ?? "?";
			const r = responses[cmd];
			if (r) return r;
			return ["0", ...parts.slice(1)];
		}),
	} as unknown as DtpClient;
}

describe("dtp-printer", () => {
	describe("getStatus", () => {
		it("parses C0 response correctly", async () => {
			const client = createMockClient({
				C0: ["0", "0", "0", "0", "0", "0", ""],
			});
			const result = await getStatus(client);
			expect(result.code).toBe(0);
			expect(result.state).toBe(0);
			expect(result.block).toBe(0);
			expect(result.fiscalStatus).toBe("0");
		});

		it("parses state=2 (document open)", async () => {
			const client = createMockClient({
				C0: ["0", "0", "2", "0", "0", "65535", ""],
			});
			const result = await getStatus(client);
			expect(result.code).toBe(0);
			expect(result.state).toBe(2);
			expect(result.block).toBe(0);
		});

		it("handles error response", async () => {
			const client = createMockClient({
				C0: ["257", ""],
			});
			const result = await getStatus(client);
			expect(result.code).toBe(257);
			expect(result.state).toBe(-1);
		});
	});

	describe("openFiscalDoc", () => {
		it("returns document number on success", async () => {
			const client = createMockClient({
				F0: ["0", "42", ""],
			});
			const result = await openFiscalDoc(client, {
				sNombreCliente: "Test Client",
				sRifCliente: "V-12345678",
				bLogo: false,
			});
			expect(result.code).toBe(0);
			expect(result.documentNumber).toBe(42);
		});

		it("sends correct args to client", async () => {
			const client = createMockClient({ F0: ["0", "1", ""] });
			await openFiscalDoc(client, {
				sNombreCliente: "Juan",
				sRifCliente: "J-11111111",
				bLogo: false,
				sLineaAdicional: "Line",
			});
			expect(client.send).toHaveBeenCalledWith(
				expect.arrayContaining([
					"F0",
					"0",
					"Juan",
					"J-11111111",
					expect.any(String),
					"0",
					"Line",
				]),
			);
		});
	});

	describe("addFiscalItem", () => {
		it("parses item response", async () => {
			const client = createMockClient({
				F1: ["0", "1", "30000", "17", ""],
			});
			const result = await addFiscalItem(client, {
				sDescripcion: "Product",
				sCodigo: "SKU001",
				lCantidad: 1000,
				sUnidad: "UND",
				lPrecio: 30000,
				iImpuesto: 1,
				iDecPrecio: 2,
				iDecCantidad: 3,
			});
			expect(result.code).toBe(0);
			expect(result.itemCount).toBe(1);
			expect(result.totalItem).toBe(30000);
			expect(result.printedLines).toBe(17);
		});
	});

	describe("subtotalFiscalDoc", () => {
		it("returns raw with lMontoTotal at index 11", async () => {
			const client = createMockClient({
				F2: [
					"0", "0", "0", "30000", "4800", "0",
					"0", "0", "0", "0", "0", "34800",
					"30000", "1", "25", "",
				],
			});
			const result = await subtotalFiscalDoc(client, 1, 0);
			expect(result.code).toBe(0);
			expect(result.raw[11]).toBe("34800");
		});
	});

	describe("payFiscalDoc", () => {
		it("returns amountDue and changeAmount", async () => {
			const client = createMockClient({
				F4: ["0", "0", "0", "27", ""],
			});
			const result = await payFiscalDoc(client, {
				iFormaPago: 1,
				sDescripcion: "EFECTIVO",
				lMonto: 34800,
			});
			expect(result.code).toBe(0);
			expect(result.amountDue).toBe(0);
			expect(result.changeAmount).toBe(0);
			expect(result.printedLines).toBe(27);
		});
	});

	describe("addFiscalComment", () => {
		it("sends comment and returns printed lines", async () => {
			const client = createMockClient({ F7: ["0", "18", ""] });
			const result = await addFiscalComment(client, "Thanks");
			expect(result.code).toBe(0);
			expect(result.printedLines).toBe(18);
			expect(client.send).toHaveBeenCalledWith(
				expect.arrayContaining(["F7", "Thanks", "0", "0", "0"]),
			);
		});
	});

	describe("closeFiscalDoc", () => {
		it("returns document number and total", async () => {
			const client = createMockClient({
				F5: ["0", "42", "34800", ""],
			});
			const result = await closeFiscalDoc(client, "");
			expect(result.code).toBe(0);
			expect(result.documentNumber).toBe(42);
			expect(result.totalAmount).toBe(34800);
		});
	});

	describe("cancelFiscalDoc", () => {
		it("sends F6 and returns code", async () => {
			const client = createMockClient({ F6: ["0", ""] });
			const result = await cancelFiscalDoc(client);
			expect(result.code).toBe(0);
			expect(client.send).toHaveBeenCalledWith(["F6"]);
		});
	});

	describe("getSerializationData", () => {
		it("parses C2 response", async () => {
			const client = createMockClient({
				C2: ["0", "SERIAL1", "PRINTER1", "KIT1", "MF1", "MA1", ""],
			});
			const result = await getSerializationData(client);
			expect(result.code).toBe(0);
			expect(result.fiscalSerial).toBe("SERIAL1");
			expect(result.printerSerial).toBe("PRINTER1");
			expect(result.kitSerial).toBe("KIT1");
		});
	});

	describe("getFiscalizationData", () => {
		it("parses C3 response", async () => {
			const client = createMockClient({
				C3: [
					"0", "Acme Inc", "Calle 1", "J-12345678",
					"Store", "Dist", "J-999", "16", "8", "0", "0", "",
				],
			});
			const result = await getFiscalizationData(client);
			expect(result.code).toBe(0);
			expect(result.taxpayerName).toBe("Acme Inc");
			expect(result.taxpayerRif).toBe("J-12345678");
			expect(result.taxRate1).toBe(16);
			expect(result.taxRate2).toBe(8);
		});
	});

	describe("getPaymentMethod", () => {
		it("returns payment method name", async () => {
			const client = createMockClient({
				C9: ["0", "EFECTIVO", ""],
			});
			const result = await getPaymentMethod(client, 1);
			expect(result.code).toBe(0);
			expect(result.name).toBe("EFECTIVO");
		});
	});

	describe("setPaymentMethod", () => {
		it("sends C10 with id and name", async () => {
			const client = createMockClient({ C10: ["0", ""] });
			await setPaymentMethod(client, 1, "EFECTIVO");
			expect(client.send).toHaveBeenCalledWith(["C10", "1", "EFECTIVO"]);
		});
	});

	describe("reportX and reportZ", () => {
		it("reportX sends R0 with 0", async () => {
			const client = createMockClient({ R0: ["0", "1", ""] });
			const result = await reportX(client, true);
			expect(client.send).toHaveBeenCalledWith(["R0", "0", "1"]);
			expect(result.code).toBe(0);
			expect(result.documentNumber).toBe(1);
		});

		it("reportZ sends R0 with 1", async () => {
			const client = createMockClient({ R0: ["0", "5", ""] });
			const result = await reportZ(client, false);
			expect(client.send).toHaveBeenCalledWith(["R0", "1"]);
			expect(result.code).toBe(0);
			expect(result.reportNumber).toBe(5);
		});
	});

	describe("getCounters", () => {
		it("parses R9 response", async () => {
			const client = createMockClient({
				R9: ["0", "10", "0", "2", "1", "3", "4", ""],
			});
			const result = await getCounters(client);
			expect(result.code).toBe(0);
			expect(result.lastInvoice).toBe(10);
			expect(result.lastCreditNote).toBe(2);
			expect(result.lastDebitNote).toBe(1);
			expect(result.lastNonFiscal).toBe(3);
			expect(result.lastZReport).toBe(4);
		});
	});

	describe("non-fiscal document", () => {
		it("openNonFiscalDoc sends N0", async () => {
			const client = createMockClient({ N0: ["0", ""] });
			const result = await openNonFiscalDoc(client);
			expect(result.code).toBe(0);
			expect(client.send).toHaveBeenCalledWith(["N0"]);
		});

		it("addNonFiscalLine sends N1 with line", async () => {
			const client = createMockClient({ N1: ["0", "12", ""] });
			const result = await addNonFiscalLine(client, "Hello");
			expect(result.code).toBe(0);
			expect(result.printedLines).toBe(12);
			expect(client.send).toHaveBeenCalledWith(
				expect.arrayContaining(["N1", "Hello"]),
			);
		});

		it("closeNonFiscalDoc sends N3 and returns document number", async () => {
			const client = createMockClient({ N3: ["0", "7", ""] });
			const result = await closeNonFiscalDoc(client);
			expect(result.code).toBe(0);
			expect(result.documentNumber).toBe(7);
			expect(client.send).toHaveBeenCalledWith(["N3"]);
		});
	});

	describe("parseCode fallback", () => {
		it("handles empty or invalid response", async () => {
			const client = createMockClient({
				C0: [],
			});
			(client.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
			const result = await getStatus(client);
			expect(result.code).toBe(16);
			expect(result.state).toBe(-1);
		});
	});
});
