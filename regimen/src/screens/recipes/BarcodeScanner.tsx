/* Barcode scanner dialog for the custom-food form.
   Web: BarcodeDetector (where supported) on a getUserMedia camera stream, or on a picked image file.
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
const detectorCtor = (): BarcodeDetectorCtor | null =>
  Platform.OS === 'web' && typeof window !== 'undefined' && 'BarcodeDetector' in window ? (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector : null;
/** True when this platform can scan (native camera, or a browser with BarcodeDetector). */
export const canScan = () => Platform.OS !== 'web' || !!detectorCtor();

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
  const Ctor = detectorCtor();
  const video = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cb = useRef(onCode); cb.current = onCode;

  useEffect(() => {
    if (!Ctor || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) { if (Ctor) setErr('No camera available in this browser. Choose a photo of the barcode instead.'); return; }
    let stream: MediaStream | null = null; let timer: ReturnType<typeof setInterval> | null = null; let alive = true;
    const det = new Ctor({ formats: FORMATS });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(st => {
      if (!alive) { st.getTracks().forEach(t => t.stop()); return; }
      stream = st; const v = video.current; if (!v) return;
      v.srcObject = st; v.play().catch(() => {});
      timer = setInterval(async () => {
        if (!v.videoWidth) return;
        try { const r = await det.detect(v); if (r[0]?.rawValue) cb.current(r[0].rawValue); } catch { /* frame not ready */ }
      }, 350);
    }).catch(() => alive && setErr('Camera permission was denied. Choose a photo of the barcode instead, or type the number.'));
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

  if (!Ctor) return (
    <Frame>
      <Icon name="barcode" size={26} color={C.n500} />
      <T size={13} center color={C.n300}>Barcode scanning isn’t supported in this browser. Enter the label manually, or type the barcode number below.</T>
    </Frame>
  );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 280, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.n900 }}>
        {createElement('video', { ref: video, muted: true, playsInline: true, autoPlay: true, style: { width: '100%', height: '100%', objectFit: 'cover' } })}
      </View>
      {err && <Muted size={12} color={C.a300}>{err}</Muted>}
      <Row><Btn icon="image" title={busy ? 'Reading…' : 'Choose a photo of the barcode'} disabled={busy} onPress={fromImage} /></Row>
    </View>
  );
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <View style={{ height: 200, borderRadius: R.md, backgroundColor: C.n900, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>{children}</View>
);
