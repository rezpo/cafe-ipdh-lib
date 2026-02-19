import { describe, expect, it } from "vitest";
import type { Order } from "../../types/order.js";
import { dtpPrinter } from "./dtp-printer-driver.js";

const mockOrder: Order = {
	client: {
		id: "V12345678",
		name: "Cliente Test",
		email: "test@example.com",
		address: "Calle 1",
	},
	items: [
		{
			id: "1",
			name: "Producto 1",
			sku: "SKU001",
			price: 10.5,
			quantity: 2,
			total: 21,
			taxes: [{ id: "IVA_G" }],
		},
	],
	payments: [
		{
			amount: 21,
			paymentMethod: "cash_nat",
			cardLast4: "",
		},
	],
	total: 21,
};

describe("dtpPrinter", () => {
	describe("buildInvoiceCommands", () => {
		it("genera comandos válidos de factura", () => {
			const commands = dtpPrinter.buildInvoiceCommands(mockOrder, {
				paymentMethodId: "cash_nat",
				storeName: "Tienda Test",
			});

			expect(commands).toBeInstanceOf(Array);
			expect(commands.length).toBeGreaterThan(0);
			expect(commands[0]).toHaveProperty("cmd", "F0");
			expect(commands[0]).toHaveProperty("data");
			expect((commands[0] as { data: { sNombreCliente: string } }).data.sNombreCliente).toBe(
				"Cliente Test",
			);
			expect(commands).toContainEqual(
				expect.objectContaining({ cmd: "F1", data: expect.objectContaining({ sCodigo: "SKU001" }) }),
			);
			expect(commands).toContainEqual(
				expect.objectContaining({ cmd: "F2", data: expect.objectContaining({ mode: 1 }) }),
			);
			expect(commands).toContainEqual(
				expect.objectContaining({ cmd: "F4", data: expect.objectContaining({ sDescripcion: "EFECTIVO" }) }),
			);
			expect(commands).toContainEqual(
				expect.objectContaining({ cmd: "F5", data: expect.anything() }),
			);
		});

		it("falla sin cliente", () => {
			const orderSinCliente: Order = {
				...mockOrder,
				client: null,
			};
			expect(() =>
				dtpPrinter.buildInvoiceCommands(orderSinCliente, {
					paymentMethodId: "cash_nat",
				}),
			).toThrow("cliente asociado");
		});

		it("agrega IGTF para pago en divisas", () => {
			const commands = dtpPrinter.buildInvoiceCommands(mockOrder, {
				paymentMethodId: "cash_int",
				storeName: "Tienda",
			});
			const igtfItem = commands.find(
				(c) =>
					c.cmd === "F1" &&
					(c as { data: { sDescripcion: string } }).data.sDescripcion.includes("IGTF"),
			);
			expect(igtfItem).toBeDefined();
		});
	});

	describe("buildReceiptCommands", () => {
		it("genera comandos DNF válidos", () => {
			const commands = dtpPrinter.buildReceiptCommands({
				orderId: "ORD-123",
				amountPaid: 100,
				paymentMethod: "Efectivo",
				organizationName: "Mi Org",
			});

			expect(commands).toBeInstanceOf(Array);
			expect(commands[0]).toHaveProperty("cmd", "N0");
			expect(commands).toContainEqual(
				expect.objectContaining({
					cmd: "N1",
					data: expect.objectContaining({ line: "RECIBO DE PAGO" }),
				}),
			);
			expect(commands).toContainEqual(
				expect.objectContaining({
					cmd: "N1",
					data: expect.objectContaining({ line: expect.stringContaining("Bs 100") }),
				}),
			);
			expect(commands).toContainEqual(expect.objectContaining({ cmd: "N3" }));
		});

		it("falla sin orderId", () => {
			expect(() =>
				dtpPrinter.buildReceiptCommands({
					orderId: "",
					amountPaid: 100,
					paymentMethod: "Efectivo",
				}),
			).toThrow("OrderId es requerido");
		});

		it("falla con monto inválido", () => {
			expect(() =>
				dtpPrinter.buildReceiptCommands({
					orderId: "ORD-1",
					amountPaid: 0,
					paymentMethod: "Efectivo",
				}),
			).toThrow("Monto pagado inválido");
		});
	});

	describe("buildCreditNoteCommands", () => {
		it("genera comandos válidos de nota de crédito", () => {
			const commands = dtpPrinter.buildCreditNoteCommands!(mockOrder, {
				referenceInvoiceNumber: 42,
				referenceInvoiceDate: new Date("2025-02-01"),
				referenceInvoiceSerial: "F001",
				paymentMethodId: "cash_nat",
				storeName: "Tienda Test",
			});

			expect(commands).toBeInstanceOf(Array);
			expect(commands.length).toBeGreaterThan(0);
			const f0 = commands[0] as { cmd: string; data: Record<string, unknown> };
			expect(f0.cmd).toBe("F0");
			expect(f0.data.iTipo).toBe(1);
			expect(f0.data.iFacturaReferencia).toBe(42);
			expect(f0.data.sSerialReferencia).toBe("F001");

			const f1Item = commands.find(
				(c) =>
					c.cmd === "F1" &&
					(c as { data: { sCodigo: string } }).data.sCodigo === "SKU001",
			) as { data: { lCantidad: number; iTipo: number } };
			expect(f1Item).toBeDefined();
			expect(f1Item.data.lCantidad).toBeLessThan(0);
			expect(f1Item.data.iTipo).toBe(1);

			expect(commands).toContainEqual(
				expect.objectContaining({ cmd: "F2", data: expect.objectContaining({ mode: 1 }) }),
			);
			expect(commands).toContainEqual(
				expect.objectContaining({ cmd: "F5", data: expect.anything() }),
			);
		});

		it("falla sin cliente", () => {
			const orderSinCliente: Order = { ...mockOrder, client: null };
			expect(() =>
				dtpPrinter.buildCreditNoteCommands!(orderSinCliente, {
					referenceInvoiceNumber: 1,
					referenceInvoiceDate: new Date(),
					paymentMethodId: "cash_nat",
				}),
			).toThrow("cliente asociado");
		});
	});
});
