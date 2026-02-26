export interface InvoiceDetail {
	description: string;
	quantity: number;
	price: number;
}

export interface InvoiceTaxBreakdown {
	taxId: string;
	name?: string;
	amount?: number;
}

export interface Invoice {
	invoiceRef: number;
	createdAt: string;
	customerName: string;
	customerID: string;
	totalAmount: number;
	details: InvoiceDetail[];
	taxesBreakdown?: InvoiceTaxBreakdown[];
}
