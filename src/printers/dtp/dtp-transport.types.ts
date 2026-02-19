/**
 * Socket mínimo requerido por DtpClient.
 * Compatible con Node net.Socket y react-native-tcp-socket.
 */
export interface DtpSocketLike {
	on(event: "data", cb: (chunk: Buffer | Uint8Array) => void): void;
	on(event: "error", cb: (err: Error) => void): void;
	on(event: "close", cb: () => void): void;
	once(event: "connect", cb: () => void): void;
	once(event: "error", cb: (err: Error) => void): void;
	write(data: Buffer | Uint8Array): void;
	end(): void;
}

/**
 * Factory para crear una conexión TCP al dispositivo DTP.
 * Debe retornar una Promise que resuelve cuando el socket está conectado.
 *
 * En Node.js, usar createNodeDtpConnection (desde /node).
 * En React Native, usar react-native-tcp-socket:
 *
 * ```ts
 * import TcpSocket from "react-native-tcp-socket";
 *
 * const createConnection: CreateDtpConnection = (opts) =>
 *   new Promise((resolve, reject) => {
 *     const socket = TcpSocket.createConnection(opts, () => resolve(socket));
 *     socket.once("error", reject);
 *   });
 *
 * const client = new DtpClient({ host, port, createConnection });
 * ```
 */
export type CreateDtpConnection = (
	opts: { host: string; port: number },
) => Promise<DtpSocketLike>;
