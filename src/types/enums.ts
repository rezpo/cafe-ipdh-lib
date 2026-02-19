/**
 * Valores de impuestos (porcentajes) según legislación venezolana.
 */
export enum TaxValues {
	EXENTO_E = 0,
	BI_G = 16.0,
	IVA_G = 16.0,
	BI_R = 8.0,
	IVA_R = 8.0,
	BI_A = 31.0,
	IVA_A = 31.0,
	PERCIBIDO = 0,
	BI_IGTF = 3.0,
	IVA_IGTF = 3.0,
}

/**
 * Códigos de impuesto para impresora fiscal AEG-R1.
 */
export enum PrinterTaxValues {
	EXENTO_E = 1,
	BI_G = 2,
	IVA_G = 2,
	BI_R = 3,
	IVA_R = 3,
	BI_A = 4,
	IVA_A = 4,
	PERCIBIDO = 5,
	BI_IGTF = 5,
	IVA_IGTF = 5,
}

/**
 * IDs de método de pago para impresora fiscal AEG-R1.
 * Efectivo: 1, Débito: 2, Crédito: 3, Pago Móvil: 5,
 * Débito/Crédito int: 11, Efectivo int: 12
 */
export enum PaymentMethodId {
	CASH = 1,
	POS_DEBIT = 2,
	POS_CREDIT = 3,
	PAGO_MOVIL = 5,
	POS_DEBIT_CREDIT_INT = 11,
	CASH_INT = 12,
}
