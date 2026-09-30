/* Barcode scanner dialog for the custom-food form.
   Web: the browser's BarcodeDetector where it reads retail barcodes (Chrome on Android, macOS), otherwise the
   zxing-wasm ponyfill (Safari on iPhone/iPad, Firefox, desktop Chrome on Windows/Linux), on a getUserMedia camera
   stream or a picked/taken photo. The ponyfill and its WebAssembly file (public/zxing_reader.wasm, served from our
   own site) load only when the scanner opens.
   Native: expo-camera CameraView with barcode scanning (permission via useCameraPermissions).
   A typed barcode number is always accepted as a fallback. */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Btn, Dialog, Field, Icon, Input, Muted, Row, T } from '@/ui/kit';
import { C, R } from '@/ui/theme';

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(src: CanvasImageSource | ImageBitmap | Blob): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
type NativeCtor = BarcodeDetectorCtor & { getSupportedFormats?: () => Promise<string[]> };

let loading: Promise<BarcodeDetectorCtor> | null = null;
/** A BarcodeDetector for this browser: the built-in one if it handles grocery barcodes, else the zxing-wasm ponyfill. */
function loadDetector(): Promise<BarcodeDetectorCtor> {
  if (!loading) loading = (async () => {
    const B = typeof window !== 'undefined' ? (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector : undefined;
    if (B) { try { const f = await B.getSupportedFormats?.(); if (f && f.includes('ean_13')) return B; } catch { /* use the ponyfill */ } }
    const m = await import('barcode-detector/ponyfill');
    const base = process.env.EXPO_PUBLIC_BASE_URL || '';
    m.setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? `${base}/${path}` : prefix + path) });
    return m.BarcodeDetector as unknown as BarcodeDetectorCtor;
  })().catch(e => { loading = null; throw e; });
  return loading;
}
/** True when this platform can scan (native camera, or any browser with a camera or photo picker). */
export const canScan = () => true;

export function BarcodeScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const [manual, setManual] = useState('');
  const done = useRef(false);
  useEffect(() => { if (open) { done.current = false; setManual(''); } }, [open]);
  const found = (code: string) => { if (done.current || !code) return; done.current = true; onCode(code.trim()); };

  return (
    <Dialog open={open} onClose={onClose} title="Scan barcode" width={520}
      body="Point your camera at the barcode. Matches are looked up on Open Food Facts and must be confirmed before saving."
      actions={<><Btn title="Cancel" onPress={onClose} /><Btn variant="primary" title="Look up" disabled={!/^\d{6,14}$/.test(manual.trim())} onPress={() => found(manual)} /></>}>
      {open && (Platform.OS === 'web' ? <WebScanner onCode={found} /> : <NativeScanner onCode={found} />)}
      <Field label="Or type the barcode number"><Input value={manual} onChange={v => setManual(v.replace(/[^\d]/g, ''))} numeric placeholder="e.g. 5000159484695" onSubmitEditing={() => found(manual)} /></Field>
    </Dialog>
  );
}

function NativeScanner({ onCode }: { onCode: (c: string) => void }) {
  const [perm, request] = useCameraPermissions();
  if (!perm) return <Frame><Muted>Checking camera permission…</Muted></Frame>;
  if (!perm.granted) return (
    <Frame>
      <Icon name="camera" size={26} color={C.n500} />
      <T size={13} center color={C.n300}>Camera access is needed to scan barcodes.</T>
      <Btn variant="primary" title="Allow camera" onPress={() => request()} />
    </Frame>
  );
  return (
    <View style={{ height: 280, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.n900 }}>
      <CameraView style={{ flex: 1 }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
        onBarcodeScanned={r => onCode(r.data)} />
    </View>
  );
}

function WebScanner({ onCode }: { onCode: (c: string) => void }) {
  const [Ctor, setCtor] = useState<BarcodeDetectorCtor | null>(null);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cb = useRef(onCode); cb.current = onCode;

  useEffect(() => { let alive = true; loadDetector().then(c => alive && setCtor(() => c), () => alive && setFailed(true)); return () => { alive = false; }; }, []);

  useEffect(() => {
    if (!Ctor) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setErr('No camera available in this browser. Take or choose a photo of the barcode instead.'); return; }
    let stream: MediaStream | null = null; let timer: ReturnType<typeof setInterval> | null = null; let alive = true; let reading = false;
    const det = new Ctor({ formats: FORMATS });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } }).then(st => {
      if (!alive) { st.getTracks().forEach(t => t.stop()); return; }
      stream = st; const v = video.current; if (!v) return;
      v.muted = true; v.setAttribute('playsinline', ''); v.srcObject = st; v.play().catch(() => {});
      timer = setInterval(async () => {
        if (!v.videoWidth || reading) return;
        reading = true;
        try { const r = await det.detect(v); if (alive && r[0]?.rawValue) cb.current(r[0].rawValue); } catch { /* frame not ready */ }
        reading = false;
      }, 300);
    }).catch(() => alive && setErr('Camera permission was denied. Take or choose a photo of the barcode instead, or type the number.'));
    return () => { alive = false; if (timer) clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [Ctor]);

  const fromImage = async () => {
    if (!Ctor) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    setBusy(true);
    try {
      const blob = await (await fetch(r.assets[0].uri)).blob(); const bmp = await createImageBitmap(blob);
      const res = await new Ctor({ formats: FORMATS }).detect(bmp);
      if (res[0]?.rawValue) onCode(res[0].rawValue); else setErr('No barcode found in that photo. Try a sharper, closer shot.');
    } catch { setErr('That image could not be read.'); }
    setBusy(false);
  };

  if (failed) return (
    <Frame>
      <Icon name="barcode" size={26} color={C.n500} />
      <T size={13} center color={C.n300}>The scanner couldn’t load. Check your connection, or type the barcode number below.</T>
    </Frame>
  );
  if (!Ctor) return <Frame><Muted>Starting the scanner…</Muted></Frame>;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 280, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.n900 }}>
        {createElement('video', { ref: video, muted: true, playsInline: true, autoPlay: true, style: { width: '100%', height: '100%', objectFit: 'cover' } })}
      </View>
      {err && <Muted size={12} color={C.a300}>{err}</Muted>}
      <Row><Btn icon="image" title={busy ? 'Reading…' : 'Take or choose a photo of the barcode'} disabled={busy} onPress={fromImage} /></Row>
    </View>
  );
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <View style={{ height: 200, borderRadius: R.md, backgroundColor: C.n900, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>{children}</View>
);
