export type AbrirCfArgs = {
	iTipo?: number; // default 0
	sNombreCliente: string;
	sRifCliente: string;
	iFacturaReferencia?: number; // default 0
	fechaReferencia?: Date; // default hoy
	sSerialReferencia?: string; // default ""
	bLogo?: boolean; // default false
	sLineaAdicional?: string; // default ""
};

export type ItemCfArgs = {
	iTipo?: number; // default 0
	sDescripcion: string;
	sCodigo: string;
	lCantidad: number; // ENTERO (ej: 1000 = 1.000 si decCantidad=3)
	sUnidad: string; // "UND"
	lPrecio: number; // ENTERO (ej: 30000 = 300.00 si decPrecio=2)
	iImpuesto: number; // 0..4 normalmente
	iDecPrecio: number; // 0..3
	iDecCantidad: number; // 0..3
};

export type PagoCfArgs = {
	iTipoPago?: number; // default 0
	iFormaPago: number; // ej: 1 efectivo
	sDescripcion: string; // "EFECTIVO"
	lMonto: number; // ENTERO (misma base que precio)
};
