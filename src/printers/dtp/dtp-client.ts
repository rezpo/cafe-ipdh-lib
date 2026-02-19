import type { CreateDtpConnection, DtpSocketLike } from "./dtp-transport.types.js";

const STX = 0x02;
const ETX = 0x03;
const FS = 0x1c;

/** Uint8Array en lugar de Buffer para compatibilidad con React Native (sin polyfill). */
function indexOfByte(arr: Uint8Array, byte: number, fromIndex = 0): number {
	for (let i = fromIndex; i < arr.length; i++) {
		if (arr[i] === byte) return i;
	}
	return -1;
}

function toUint8Array(chunk: Buffer | Uint8Array | ArrayBuffer): Uint8Array {
	if (chunk instanceof Uint8Array) return chunk;
	if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
	const v = chunk as ArrayBufferView;
	return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	const total = arrays.reduce((s, a) => s + a.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const a of arrays) {
		out.set(a, offset);
		offset += a.length;
	}
	return out;
}

export type DtpOptions = {
	host: string;
	port: number;
	connectTimeoutMs?: number;
	commandTimeoutMs?: number;
	/** Factory para crear la conexión TCP. Requerido. En Node usa createNodeDtpConnection; en RN usa react-native-tcp-socket. */
	createConnection: CreateDtpConnection;
};

export class DtpClient {
	private socket: DtpSocketLike | null = null;
	private buffer: Uint8Array = new Uint8Array(0);
	private pending: {
		resolve: (v: string[]) => void;
		reject: (e: Error) => void;
		timer: ReturnType<typeof setTimeout>;
	} | null = null;
	private decoder = new TextDecoder("utf-8");
	private encoder = new TextEncoder();

	constructor(private opts: DtpOptions) {}

	async connect(): Promise<void> {
		if (this.socket) return;

		const timeoutMs = this.opts.connectTimeoutMs ?? 3000;

		const socket = await Promise.race([
			this.opts.createConnection({
				host: this.opts.host,
				port: this.opts.port,
			}),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Connect timeout")), timeoutMs),
			),
		]);

		this.socket = socket;

		socket.on("data", (chunk: Buffer | Uint8Array | ArrayBuffer) => {
			this.onData(toUint8Array(chunk));
		});
		socket.on("error", (e) => this.onError(e));
		socket.on("close", () => this.onClose());
	}

	close(): void {
		this.socket?.end();
		this.socket = null;
		this.buffer = new Uint8Array(0);
	}

	async send(parts: string[]): Promise<string[]> {
		if (!this.socket) throw new Error("Socket not connected");

		if (this.pending) throw new Error("Another command is in-flight");

		const frame = this.buildFrame(parts);
		const timeoutMs = this.opts.commandTimeoutMs ?? 10_000;

		return await new Promise<string[]>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending = null;
				reject(new Error(`Command timeout: ${parts[0]}`));
			}, timeoutMs);

			this.pending = { resolve, reject, timer };

			this.socket?.write(frame);
		});
	}

	private buildFrame(parts: string[]): Uint8Array {
		const payload = this.encoder.encode(parts.join(String.fromCharCode(FS)));
		return concatUint8Arrays([
			new Uint8Array([STX]),
			payload,
			new Uint8Array([ETX]),
		]);
	}

	private tryParseOneFrame(): string[] | null {
		const start = indexOfByte(this.buffer, STX);
		const end = indexOfByte(this.buffer, ETX, start + 1);

		if (start === -1 || end === -1) return null;

		const body = this.buffer.subarray(start + 1, end);

		this.buffer = new Uint8Array(this.buffer.subarray(end + 1));

		const params = this.decoder.decode(body).split(String.fromCharCode(FS));
		return params;
	}

	private onData(chunk: Uint8Array) {
		this.buffer = concatUint8Arrays([this.buffer, chunk]);

		const params = this.tryParseOneFrame();
		if (!params) return;

		if (!this.pending) return;

		const { resolve, timer } = this.pending;
		clearTimeout(timer);
		this.pending = null;

		resolve(params);
	}

	private onError(e: Error) {
		if (this.pending) {
			const { reject, timer } = this.pending;
			clearTimeout(timer);
			this.pending = null;
			reject(e);
		}
	}

	private onClose() {
		if (this.pending) {
			const { reject, timer } = this.pending;
			clearTimeout(timer);
			this.pending = null;
			reject(new Error("Socket closed"));
		}
	}
}
