/**
 * Cliente para facturación fiscal.
 * Interface mínima requerida para construir comandos de impresora.
 */
export interface FiscalClient {
	id: string;
	name: string;
	email?: string;
	phone?: string;
	address?: string;
}

/**
 * Impuesto de un item (usado para mapeo a códigos de impresora).
 * id puede ser null (ej: GraphQL ItemTax).
 */
export interface ItemTax {
	id: string | null;
}

/**
 * Item de orden para facturación fiscal.
 */
export interface OrderItem {
	id: string;
	name: string;
	sku: string;
	price: number;
	quantity: number;
	total: number;
	taxes?: ItemTax[];
	selectedQuantity?: number;
}

/**
 * Pago completado de una orden.
 */
export interface OrderPayment {
	amount: number;
	paymentMethod: string;
	cardLast4?: string;
}

/**
 * Orden para facturación.
 * Interface mínima para construir comandos de impresora.
 */
export interface Order {
	items: OrderItem[];
	payments: OrderPayment[];
	total: number;
	client: FiscalClient | null;
	status?: "pending" | "completed" | "canceled" | null;
}
