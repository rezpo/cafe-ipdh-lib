/**
 * Comandos JSON para impresora fiscal AEG-R1.
 * Según documentación oficial AEG-R1.
 */
export type AegPrinterCommand =
	| {
			cmd: "cliF";
			data: {
				rifCI: string;
				razSoc: string[];
				LineAd: string[];
			};
	  }
	| {
			cmd: "proF";
			data: {
				imp: number;
				pre: number;
				cant: number;
				des01: string;
			};
	  }
	| { cmd: "subToF"; data: number; valor: number }
	| {
			cmd: "fpaF";
			data: {
				tipo: number;
				monto: number;
				tasaConv: number;
			};
	  }
	| { cmd: "endFac"; data: number }
	| { cmd: "encDNF"; data: [string, string] }
	| { cmd: "txtDNF"; data: [string, string, string, string, string] }
	| { cmd: "aperDNF"; data: string }
	| { cmd: "efeNorJuIzDNF"; data: string }
	| { cmd: "endDNF"; data: string }
	| { cmd: "encNC"; data: [string, string] | [string, string, string] }
	| { cmd: "nroFacNC"; data: number }
	| { cmd: "fechFacNC"; data: string }
	| { cmd: "conSerNC"; data: string }
	| { cmd: "rifCiNC"; data: string }
	| { cmd: "razSocNC"; data: { razSoc: string[]; LineAd: string[] } }
	| {
			cmd: "prodNC";
			data: {
				imp: number;
				pre: number;
				cant: number;
				des01: string;
			};
	  }
	| { cmd: "endPoNC"; data: number }
	| {
			cmd: "fpaNC";
			data: {
				tipo: number;
				monto: number;
				tasaConv: number;
			};
	  }
	| { cmd: "endNC"; data: number };
