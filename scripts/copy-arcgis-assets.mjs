// Copia el módulo de geometría de ArcGIS (pe-wasm) a public/ para que la web
// lo sirva ella misma: así funciona sin conexión y sin pedir nada a terceros.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const FILE = "esri/geometry/support/pe-wasm.wasm";
const from = `node_modules/@arcgis/core/assets/${FILE}`;
const to = `public/arcgis/${FILE}`;
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log(`ArcGIS: ${from} -> ${to}`);
