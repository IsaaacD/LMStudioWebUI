// QR code generator using qrcode-generator (kazuhikoarase)
// Loads from CDN in index.html, exposes global `qrcode`

export function createQRCanvas(url, size) {
    size = size || 256;

    if (typeof qrcode === 'undefined') {
        throw new Error('qrcode-generator library not loaded');
    }

    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    const dim = qr.getModuleCount();
    const quiet = 4;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const cellSize = size / (dim + quiet * 2);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';

    for (let r = 0; r < dim; r++) {
        for (let c = 0; c < dim; c++) {
            if (qr.isDark(r, c)) {
                ctx.fillRect(
                    Math.floor((c + quiet) * cellSize),
                    Math.floor((r + quiet) * cellSize),
                    Math.ceil(cellSize),
                    Math.ceil(cellSize)
                );
            }
        }
    }

    return canvas;
}
