# cafe-ipdh-lib

Librería para gestionar impresoras fiscales y de recibos. Construye comandos y los envía mediante una API unificada (`sendPrinterCommands`) que soporta AEG y DTP.

## Modelos soportados

| Marca | Modelo | Transporte |
|-------|--------|------------|
| **AEG** | R1 | HTTP (POST a `/cmdoJson`) |
| **DTP** | 80i | TCP |

## Instalación

```bash
npm install @danielrebolledo/cafe-ipdh-lib
```

## Uso unificado: `sendPrinterCommands`

Tanto AEG como DTP usan la misma función:

```ts
import {
  aegPrinter,
  dtpPrinter,
  sendPrinterCommands,
  DtpClient,
} from "@danielrebolledo/cafe-ipdh-lib";

const order = {
  client: { id: "V12345678", name: "Cliente", email: "c@mail.com" },
  items: [{ id: "1", name: "Producto", sku: "SKU1", price: 10, quantity: 1, total: 10, taxes: [{ id: "IVA_G" }] }],
  payments: [{ amount: 10, paymentMethod: "cash_nat" }],
  total: 10,
};

// AEG-R1 (HTTP)
const resultAeg = await sendPrinterCommands({
  brand: "AEG",
  model: "R1",
  ip: "http://192.168.1.100",
  commands: aegPrinter.buildInvoiceCommands(order, {
    paymentMethodId: "cash_nat",
    storeName: "Mi Tienda",
  }),
});

// DTP-80i (TCP; requiere client ya conectado)
const resultDtp = await sendPrinterCommands({
  brand: "DTP",
  model: "80i",
  client: dtpClient, // DtpClient conectado
  commands: dtpPrinter.buildInvoiceCommands(order, {
    paymentMethodId: "cash_nat",
    storeName: "Mi Tienda",
  }),
});
```

## Ejemplos por entorno

### Web (AEG-R1)

En un proyecto web (Next.js, Vite, etc.), normalmente se usa AEG por HTTP:

```ts
import {
  aegPrinter,
  sendPrinterCommands,
  type Order,
} from "@danielrebolledo/cafe-ipdh-lib";

async function imprimirFactura(order: Order, printerIp: string) {
  const commands = aegPrinter.buildInvoiceCommands(order, {
    paymentMethodId: "cash_nat",
    storeName: "Mi Tienda",
  });

  const result = await sendPrinterCommands({
    brand: "AEG",
    model: "R1",
    ip: printerIp,
    commands,
  });

  const invoiceRef = Array.isArray(result)
    ? result.find((r) => r.cmd === "endFac")?.dataD ?? 0
    : result.documentNumber ?? 0;

  return { success: true, invoiceRef };
}
```

### React Native (DTP-80i)

En React Native (Expo, etc.) se suele usar DTP vía TCP con `react-native-tcp-socket`:

```bash
npm install react-native-tcp-socket
```

```ts
import TcpSocket from "react-native-tcp-socket";
import {
  DtpClient,
  dtpPrinter,
  sendPrinterCommands,
  type Order,
} from "@danielrebolledo/cafe-ipdh-lib";

const createConnection = (opts: { host: string; port: number }) =>
  new Promise((resolve, reject) => {
    const socket = TcpSocket.createConnection(opts, () => resolve(socket));
    socket.once("error", reject);
  });

async function imprimirFactura(order: Order, host: string, port: number) {
  const client = new DtpClient({
    host,
    port,
    connectTimeoutMs: 15000,
    createConnection: createConnection as any,
  });

  try {
    await client.connect();

    const commands = dtpPrinter.buildInvoiceCommands(order, {
      paymentMethodId: "cash_nat",
      storeName: "Mi Tienda",
    });

    const result = await sendPrinterCommands({
      brand: "DTP",
      model: "80i",
      client,
      commands,
    });

    return {
      success: true,
      invoiceRef: result.documentNumber ?? 0,
    };
  } finally {
    client.close();
  }
}
```

## API

### Drivers

| Driver | Modelo | Métodos |
|--------|--------|---------|
| `aegPrinter` | AEG-R1 | `buildInvoiceCommands`, `buildReceiptCommands` |
| `dtpPrinter` | DTP-80i | `buildInvoiceCommands`, `buildReceiptCommands`, `buildCreditNoteCommands` |

### `sendPrinterCommands`

Función unificada para enviar comandos a cualquier impresora.

- **AEG**: `{ brand: "AEG", model: "R1", ip, commands }`
- **DTP**: `{ brand: "DTP", model: "80i", client, commands }`

Retorna:
- AEG: `PrinterCommandResponse[]`
- DTP: `{ documentNumber?: number; totalAmount?: number }`

### Node.js y DTP

Para usar DTP en Node.js (backend), importa `createNodeDtpConnection` del entry `node`:

```ts
import {
  DtpClient,
  dtpPrinter,
  sendPrinterCommands,
} from "@danielrebolledo/cafe-ipdh-lib";
import {
  createNodeDtpConnection,
} from "@danielrebolledo/cafe-ipdh-lib/node";

const client = new DtpClient({
  host: "192.168.1.10",
  port: 3010,
  createConnection: createNodeDtpConnection,
});
await client.connect();

const result = await sendPrinterCommands({
  brand: "DTP",
  model: "80i",
  client,
  commands: dtpPrinter.buildInvoiceCommands(order, opts),
});
```

### Tipos exportados

- `Order`, `OrderItem`, `FiscalClient`, `OrderPayment`
- `AegPrinterCommand`, `DtpPrinterCommand`
- `BuildInvoiceOptions`, `BuildReceiptOptions`, `BuildCreditNoteOptions`
- `SendPrinterCommandsArgs`, `SendPrinterCommandsResult`
- `PaymentMethodId`, `PrinterTaxValues`, `TaxValues`

## Scripts

```bash
npm run build    # Compilar
npm run dev     # Watch mode
npm run lint    # Biome
npm run test    # Vitest
```

## Stack

- TypeScript
- tsup
- Biome
- Vitest
