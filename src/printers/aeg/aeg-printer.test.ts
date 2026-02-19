import { describe, expect, it } from "vitest";
import type { Order } from "../../types/order.js";
import { aegPrinter } from "./aeg-printer.js";

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

describe("aegPrinter", () => {
	it("buildInvoiceCommands genera comandos válidos", () => {
		const commands = aegPrinter.buildInvoiceCommands(mockOrder, {
			paymentMethodId: "cash_nat",
			storeName: "Tienda Test",
		});

		expect(commands).toBeInstanceOf(Array);
		expect(commands.length).toBeGreaterThan(0);
		expect(commands[0]).toHaveProperty("cmd", "cliF");
		expect(commands).toContainEqual(
			expect.objectContaining({ cmd: "endFac", data: 1 }),
		);
	});

	it("buildInvoiceCommands falla sin cliente", () => {
		const orderSinCliente: Order = {
			...mockOrder,
			client: null,
		};
		expect(() =>
			aegPrinter.buildInvoiceCommands(orderSinCliente, {
				paymentMethodId: "cash_nat",
			}),
		).toThrow("cliente asociado");
	});

	it("buildReceiptCommands genera comandos DNF válidos", () => {
		const commands = aegPrinter.buildReceiptCommands({
			orderId: "ORD-123",
			amountPaid: 100,
			paymentMethod: "Efectivo",
			organizationName: "Mi Org",
		});

		expect(commands).toBeInstanceOf(Array);
		expect(commands[0]).toHaveProperty("cmd", "encDNF");
		expect(commands).toContainEqual(expect.objectContaining({ cmd: "endDNF" }));
	});

	it("buildReceiptCommands falla sin orderId", () => {
		expect(() =>
			aegPrinter.buildReceiptCommands({
				orderId: "",
				amountPaid: 100,
				paymentMethod: "Efectivo",
			}),
		).toThrow("OrderId es requerido");
	});
});
