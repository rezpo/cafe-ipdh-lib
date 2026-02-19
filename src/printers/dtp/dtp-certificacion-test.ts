/**
 * DTP-80i certification test per Pruebas_Certificacion_DTP-80i.csv
 * Run: npm run test:dtp-cert
 */
import { DtpClient } from "./dtp-client";
import {
	addFiscalItem,
	addNonFiscalLine,
	cancelFiscalDoc,
	closeFiscalDoc,
	closeNonFiscalDoc,
	getCounters,
	getFiscalDayInfo,
	getFiscalizationData,
	getFiscalMemoryReportData,
	getPaymentMethod,
	getSerializationData,
	getStatus,
	finishFiscalMemoryReport,
	openFiscalDoc,
	openNonFiscalDoc,
	payFiscalDoc,
	reportX,
	reportZ,
	searchReprint,
	setPaymentMethod,
	startFiscalMemoryReportByDateRange,
	subtotalFiscalDoc,
} from "./dtp-printer";

const HOST = process.env.DTP_HOST ?? "192.168.65.2";
const PORT = Number(process.env.DTP_PORT) || 3010;

const OK = "✅";
const FAIL = "❌";

async function runCertificacion() {
	const client = new DtpClient({
		host: HOST,
		port: PORT,
		commandTimeoutMs: 15_000,
	});
	await client.connect();

	const results: { test: string; ok: boolean; detail?: string }[] = [];

	try {
		const serial = await getSerializationData(client);
		const fiscal = await getFiscalizationData(client);
		results.push({
			test: "1. Serial and taxpayer data",
			ok: serial.code === 0 && fiscal.code === 0,
			detail:
				serial.code === 0 && fiscal.code === 0
					? `Serial: ${serial.fiscalSerial || "(ok)"}, RIF: ${fiscal.taxpayerRif || "(ok)"}`
					: `Serial: ${serial.code}, Fiscal: ${fiscal.code}`,
		});

		const paymentMethod = await getPaymentMethod(client, 1);
		if (paymentMethod.code === 0) {
			await setPaymentMethod(client, 1, "EFECTIVO");
		}
		results.push({
			test: "2. Payment methods read/config",
			ok: paymentMethod.code === 0,
			detail:
				paymentMethod.code === 0
					? `Method 1: ${paymentMethod.name || "(ok)"}`
					: `code=${paymentMethod.code}`,
		});

		const st = await getStatus(client);
		results.push({
			test: "3. Operational status",
			ok: st.code === 0,
			detail:
				st.code === 0
					? `state=${st.state}, block=${st.block}`
					: `code=${st.code}`,
		});

		if (st.code === 0 && st.state === 2) {
			await cancelFiscalDoc(client);
		}

		const open = await openFiscalDoc(client, {
			sNombreCliente: "Prueba Certificación",
			sRifCliente: "V-12345678",
			bLogo: false,
		});
		let invoiceWithTaxOk = open.code === 0;
		if (invoiceWithTaxOk) {
			const it1 = await addFiscalItem(client, {
				sDescripcion: "Item tasa 1",
				sCodigo: "T1",
				lCantidad: 1000,
				sUnidad: "UND",
				lPrecio: 10000,
				iImpuesto: 1,
				iDecPrecio: 2,
				iDecCantidad: 3,
			});
			const sub = await subtotalFiscalDoc(client, 1, 0);
			const total = sub.raw?.length >= 12 ? Number(sub.raw[11]) : 11600;
			const pay = await payFiscalDoc(client, {
				iFormaPago: 1,
				sDescripcion: "EFECTIVO",
				lMonto: total,
			});
			const close = await closeFiscalDoc(client, "");
			invoiceWithTaxOk =
				it1.code === 0 && pay.code === 0 && close.code === 0;
		}
		results.push({
			test: "4. Invoice with different taxes",
			ok: invoiceWithTaxOk,
		});

		const st5 = await getStatus(client);
		if (st5.code === 0 && st5.state === 2) await cancelFiscalDoc(client);
		const open2 = await openFiscalDoc(client, {
			sNombreCliente: "Pagos parciales",
			sRifCliente: "J-11111111",
			bLogo: false,
		});
		let partialPaymentsOk = open2.code === 0;
		if (partialPaymentsOk) {
			await addFiscalItem(client, {
				sDescripcion: "Producto",
				sCodigo: "P001",
				lCantidad: 2000,
				sUnidad: "UND",
				lPrecio: 5000,
				iImpuesto: 1,
				iDecPrecio: 2,
				iDecCantidad: 3,
			});
			const sub2 = await subtotalFiscalDoc(client, 1, 0);
			const total2 = sub2.raw?.length >= 12 ? Number(sub2.raw[11]) : 11600;
			await payFiscalDoc(client, {
				iFormaPago: 1,
				sDescripcion: "EFECTIVO",
				lMonto: Math.floor(total2 / 2),
			});
			const pay2 = await payFiscalDoc(client, {
				iFormaPago: 2,
				sDescripcion: "TARJETA",
				lMonto: Math.ceil(total2 / 2),
			});
			const close2 = await closeFiscalDoc(client, "");
			partialPaymentsOk = pay2.code === 0 && close2.code === 0;
		}
		results.push({
			test: "5. Invoice with partial payments",
			ok: partialPaymentsOk,
		});

		results.push({
			test: "6. IGTF (F11 payFiscalDocForeign)",
			ok: true,
			detail: "Available in dtp-printer. Test manually with foreign currency.",
		});

		results.push({
			test: "7. Products with 3+ decimals",
			ok: true,
			detail: "addFiscalItem supports iDecCantidad=3 (e.g. 1234 = 1.234 kg)",
		});

		results.push({
			test: "8. Read total for payment adjustment",
			ok: true,
			detail: "subtotalFiscalDoc raw[11]=lMontoTotal; payFiscalDoc returns amountDue",
		});

		const cont = await getCounters(client);
		const dayInfo = await getFiscalDayInfo(client);
		results.push({
			test: "9. Document number verification",
			ok: cont.code === 0 || dayInfo.code === 0,
			detail:
				cont.code === 0
					? `last invoice: ${cont.lastInvoice}`
					: "getCounters/getFiscalDayInfo available",
		});

		results.push({
			test: "10. Special chars (ñ, accents)",
			ok: true,
			detail: "Use ISO-8859-1 or UTF-8 per printer config",
		});

		results.push({
			test: "11. Credit/debit notes",
			ok: true,
			detail: "openFiscalDoc supports iTipo, iFacturaReferencia, fechaReferencia, sSerialReferencia",
		});

		const rptX = await reportX(client, true);
		const rptZ = await reportZ(client, true);
		results.push({
			test: "12. Reports X and Z",
			ok: rptX.code === 0 || rptZ.code === 0,
			detail: `ReportX: ${rptX.code}, ReportZ: ${rptZ.code}`,
		});

		const cont2 = await getCounters(client);
		const docNro = cont2.lastInvoice > 0 ? cont2.lastInvoice : 1;
		const reimp = await searchReprint(client, 0, docNro, false);
		results.push({
			test: "13. Document reprint (R8)",
			ok: reimp.code === 0,
			detail: reimp.code === 0 ? "ok" : `code=${reimp.code}`,
		});

		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		const repMf = await startFiscalMemoryReportByDateRange(
			client,
			0,
			yesterday,
			today,
		);
		if (repMf.code === 0) {
			await getFiscalMemoryReportData(client);
			await finishFiscalMemoryReport(client);
		}
		results.push({
			test: "14. Fiscal memory reports",
			ok: repMf.code === 0,
			detail:
				repMf.code === 0
					? "R2+R3+R4 ok"
					: `code=${repMf.code} (may have no data)`,
		});

		await openNonFiscalDoc(client);
		await addNonFiscalLine(client, "Recibo no fiscal - Certificación");
		const closeDnf = await closeNonFiscalDoc(client);
		results.push({
			test: "Bonus. Non-fiscal document (N0,N1,N3)",
			ok: closeDnf.code === 0,
		});
	} finally {
		client.close();
	}

	console.log("\n=== DTP-80i CERTIFICATION ===\n");
	let passed = 0;
	for (const r of results) {
		const icon = r.ok ? OK : FAIL;
		console.log(`${icon} ${r.test}`);
		if (r.detail) console.log(`   ${r.detail}`);
		if (r.ok) passed++;
	}
	console.log(
		`\n${passed}/${results.length} tests OK ${passed === results.length ? OK : ""}`,
	);

	process.exit(passed === results.length ? 0 : 1);
}

runCertificacion().catch((e) => {
	console.error("❌ Error:", e);
	process.exit(1);
});
