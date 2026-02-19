/**
 * Entry point para entornos Node.js.
 * Proporciona createNodeDtpConnection para conectar vía TCP nativo.
 * Usar solo en Node.js - NO en React Native/Expo/Browser.
 *
 * ```ts
 * import { createNodeDtpConnection, DtpClient, executeDtpCommands } from "@danielrebolledo/cafe-ipdh-lib/node";
 *
 * const client = new DtpClient({
 *   host: "192.168.1.10",
 *   port: 3010,
 *   createConnection: createNodeDtpConnection(),
 * });
 * await client.connect();
 * ```
 */

export type { DtpOptions } from "./printers/dtp/dtp-client.js";
export { DtpClient } from "./printers/dtp/dtp-client.js";
export { executeDtpCommands } from "./printers/dtp/dtp-printer-driver.js";
export type { DtpPrinterCommand } from "./printers/dtp/dtp-commands.js";
export type { ExecuteDtpCommandsResult } from "./printers/dtp/dtp-printer-driver.js";
export { createNodeDtpConnection } from "./printers/dtp/dtp-client-node.js";
