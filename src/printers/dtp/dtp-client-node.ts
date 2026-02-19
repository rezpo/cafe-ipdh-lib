/**
 * Transport TCP para Node.js. Usa el módulo nativo "net".
 * Solo importar en entornos Node.js (backend).
 */
import net from "node:net";
import type { CreateDtpConnection } from "./dtp-transport.types.js";

export const createNodeDtpConnection: CreateDtpConnection = (opts) =>
	new Promise((resolve, reject) => {
		const socket = net.createConnection(opts);
		socket.once("connect", () => resolve(socket));
		socket.once("error", reject);
	});
