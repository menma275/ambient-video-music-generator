/**
 * RGBからHSVに変換する
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {Object} {h, s, v} h: 0-360, s: 0-1, v: 0-1
 */
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    let h = 0;
    const s = max === 0 ? 0 : diff / max;
    const v = max;

    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
            case g: h = (b - r) / diff + 2; break;
            case b: h = (r - g) / diff + 4; break;
        }
        h /= 6;
    }

    return {
        h: h * 360,
        s: s,
        v: v
    };
}
