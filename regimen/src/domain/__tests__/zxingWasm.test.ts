/* The barcode scanner's WebAssembly file is served from our own site (public/zxing_reader.wasm). It must be the exact
   build the installed zxing-wasm expects, so a package upgrade without re-copying the file fails here, not on a phone. */
import { readFileSync } from 'fs';
import { join } from 'path';

test('public/zxing_reader.wasm matches the installed zxing-wasm', () => {
  const root = join(__dirname, '../../..');
  const ours = readFileSync(join(root, 'public/zxing_reader.wasm'));
  const pkg = readFileSync(join(root, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'));
  expect(ours.equals(pkg)).toBe(true);
});
