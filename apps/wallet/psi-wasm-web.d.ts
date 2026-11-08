// psi.js 2.0.6 ships the browser build as psi_wasm_web.js but its types as wasm_web.d.ts.
// Point the import used in lib/psi.ts at those real types.
declare module "@openmined/psi.js/psi_wasm_web" {
  export { default } from "@openmined/psi.js/wasm_web";
}
