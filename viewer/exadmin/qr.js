import qrcode from "qrcode-generator";

// A QR code as SVG markup (black on white, whatever the theme: scanners
// expect it), for the authenticator app's otpauth:// address.
export function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
}
