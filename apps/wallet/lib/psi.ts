"use client";
// Private set intersection in the browser, using OpenMined psi.js 2.0.6 (same version and parameters as the helper service).
// Wallet A is the client and wallet B the server. Sets are padded to PAD_TO so set size leaks nothing.
export const PAD_TO = 128, FPR = 1e-9;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Psi = any;
let cached: Promise<Psi> | undefined;
let loader = async (): Promise<Psi> => {
  const mod = (await import("@openmined/psi.js/psi_wasm_web")) as unknown as { default: () => Promise<Psi> };
  return mod.default();
};
/** Tests use the Node build of the same library. */
export const setPsiLoader = (f: () => Promise<Psi>) => { loader = f; cached = undefined; };
export const getPsi = () => (cached ??= loader());

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
export const pad = (tokens: string[]) => [...tokens, ...Array.from({ length: PAD_TO - tokens.length }, randomToken)];

/** Server (wallet B): publish a setup and answer the client's request. */
export async function serverRespond(tokens: string[], request: Uint8Array, reveal: boolean) {
  const psi = await getPsi();
  const server = psi.server.createWithNewKey(reveal);
  const setup = server.createSetupMessage(FPR, PAD_TO, pad(tokens), psi.dataStructure.GCS);
  const response = server.processRequest(psi.request.deserializeBinary(request));
  return { setup: setup.serializeBinary() as Uint8Array, response: response.serializeBinary() as Uint8Array };
}

/** Client (wallet A): make the request, keeping the key until the answer arrives. */
export async function clientStart(tokens: string[], reveal: boolean) {
  const psi = await getPsi();
  const client = psi.client.createWithNewKey(reveal);
  const items = pad(tokens);
  return {
    items, request: client.createRequest(items).serializeBinary() as Uint8Array,
    finish(setup: Uint8Array, response: Uint8Array) {
      const s = psi.serverSetup.deserializeBinary(setup), r = psi.response.deserializeBinary(response);
      return reveal
        ? { shared: (client.getIntersection(s, r) as number[]).map((i) => items[i]) }
        : { count: client.getIntersectionSize(s, r) as number };
    },
  };
}
