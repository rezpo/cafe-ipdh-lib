import { createNodeDtpConnection } from "./dtp-client-node";
import { DtpClient } from "./dtp-client";
import {
	addFiscalComment,
	addFiscalItem,
	cancelFiscalDoc,
	closeFiscalDoc,
	getStatus,
	openFiscalDoc,
	payFiscalDoc,
	subtotalFiscalDoc,
} from "./dtp-printer";

const HOST = process.env.DTP_HOST ?? "192.168.65.2";
const PORT = Number(process.env.DTP_PORT) || 3010;

/** State 2 = fiscal document open (cannot open new doc until cancel/close) */
const STATE_DOC_OPEN = 2;

async function main() {
	const client = new DtpClient({
		host: HOST,
		port: PORT,
		commandTimeoutMs: 10_000,
		createConnection: createNodeDtpConnection,
	});
	await client.connect();
	console.log("✅ Connected", { HOST, PORT });

	const st = await getStatus(client);
	console.log("🩺 Status:", st);

	if (st.code === 0 && st.state === STATE_DOC_OPEN) {
		console.log("⚠️ Open document detected, canceling...");
		const cancel = await cancelFiscalDoc(client);
		console.log("🗑️ CancelFiscalDoc:", cancel);
		if (cancel.code !== 0) {
			throw new Error(`CancelFiscalDoc failed: ${cancel.code}`);
		}
	}

	let open = await openFiscalDoc(client, {
		sNombreCliente: "CLIENTE PRUEBA",
		sRifCliente: "V-12345678",
		bLogo: false,
		sLineaAdicional: "TEST DTP DESDE MAC",
	});
	console.log("🧾 OpenFiscalDoc:", open);

	if (open.code === 257) {
		console.log("⚠️ OpenFiscalDoc 257, trying CancelFiscalDoc and retry...");
		const cancel = await cancelFiscalDoc(client);
		console.log("🗑️ CancelFiscalDoc:", cancel);
		open = await openFiscalDoc(client, {
			sNombreCliente: "CLIENTE PRUEBA",
			sRifCliente: "V-12345678",
			bLogo: false,
			sLineaAdicional: "TEST DTP DESDE MAC",
		});
		console.log("🧾 OpenFiscalDoc (retry):", open);
	}
	if (open.code !== 0) {
		throw new Error(`OpenFiscalDoc failed: code=${open.code}`);
	}

	const it = await addFiscalItem(client, {
		sDescripcion: "Producto demo",
		sCodigo: "SKU001",
		lCantidad: 1000,
		sUnidad: "UND",
		lPrecio: 30000,
		iImpuesto: 1,
		iDecPrecio: 2,
		iDecCantidad: 3,
	});
	console.log("📦 Item:", it);

	const com = await addFiscalComment(client, "Gracias por su compra");
	console.log("💬 Comment:", com);

	const sub = await subtotalFiscalDoc(client, 1, 0);
	console.log("🧮 Subtotal:", sub);
	if (sub.code !== 0) {
		throw new Error(`Subtotal failed: code=${sub.code}`);
	}

	const totalToPay = sub.raw?.length >= 12 ? Number(sub.raw[11]) : 34800;
	const pay = await payFiscalDoc(client, {
		iFormaPago: 1,
		sDescripcion: "EFECTIVO",
		lMonto: totalToPay,
	});
	console.log("💵 Pay:", pay);
	if (pay.code !== 0) {
		throw new Error(`Pay failed: code=${pay.code}`);
	}

	const close = await closeFiscalDoc(client, "");
	console.log("✅ CloseFiscalDoc:", close);
	if (close.code !== 0) {
		throw new Error(`CloseFiscalDoc failed: code=${close.code}`);
	}

	console.log("\n✅ Invoice printed successfully");
	client.close();
}

main().catch((e) => {
	console.error("❌ Test failed:", e);
	process.exit(1);
});
