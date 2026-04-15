// operators/transform/fft.js
//
// Cooley-Tukey radix-2 DIT (Decimation-In-Time) FFT — zero external dependencies.
//
// Public API:
//   cooleyTukeyFFT(x: number[]) → {re: number, im: number}[]
//
//   x       — real-valued input samples (any length; padded to next power-of-2 internally)
//   returns — full N-point complex spectrum (N = next power-of-2 >= x.length)
//             PLUS a `paddedLength` property on the returned array.
//
// Design notes:
//   - Pure function; no mutation of input array.
//   - Works on real inputs by treating them as complex (im = 0).
//   - Uses iterative (bottom-up) butterfly structure — no recursion stack overhead.
//   - Twiddle factors computed per-call (no global cache to violate zero-dep / purity).
//   - Output length is always a power-of-2 (padding with zeros if input is not).

/**
 * Return the smallest power-of-2 >= n.
 * @param {number} n
 * @returns {number}
 */
function nextPow2(n) {
    if (n <= 1) return 1;
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

/**
 * Bit-reversal permutation index for n-bit word.
 * @param {number} x
 * @param {number} bits
 * @returns {number}
 */
function bitReverse(x, bits) {
    let rev = 0;
    for (let i = 0; i < bits; i++) {
        rev = (rev << 1) | (x & 1);
        x >>= 1;
    }
    return rev;
}

/**
 * Cooley-Tukey radix-2 DIT FFT (iterative).
 *
 * @param {number[]} x  Real-valued time-domain samples.
 * @returns {{re: number, im: number}[] & {paddedLength: number}}
 *   Full complex spectrum of length N (next power-of-2 >= x.length).
 *   The array has an extra `paddedLength` property recording N.
 */
export function cooleyTukeyFFT(x) {
    const origLen = x.length;
    const N = nextPow2(origLen);
    const logN = Math.log2(N);

    // Allocate working arrays (real and imaginary parts flat for performance)
    const re = new Float64Array(N);
    const im = new Float64Array(N); // stays zero — real input

    // Copy input (zero-pad remainder)
    for (let i = 0; i < origLen; i++) re[i] = x[i];

    // Bit-reversal permutation
    for (let i = 0; i < N; i++) {
        const j = bitReverse(i, logN);
        if (j > i) {
            // Swap re
            const tmpR = re[i]; re[i] = re[j]; re[j] = tmpR;
            // Swap im (all zero initially, but kept for correctness after first passes)
            const tmpI = im[i]; im[i] = im[j]; im[j] = tmpI;
        }
    }

    // Iterative butterfly stages
    for (let s = 1; s <= logN; s++) {
        const m = 1 << s;           // butterfly span = 2^s
        const halfM = m >> 1;       // = 2^(s-1)
        const angle = -2 * Math.PI / m;
        const wRe = Math.cos(angle); // principal twiddle factor real part
        const wIm = Math.sin(angle); // principal twiddle factor imaginary part

        for (let k = 0; k < N; k += m) {
            // Twiddle accumulator, starts at W^0 = 1
            let tRe = 1;
            let tIm = 0;

            for (let j = 0; j < halfM; j++) {
                const uRe = re[k + j];
                const uIm = im[k + j];

                // t * X[k + j + halfM]
                const vRe = tRe * re[k + j + halfM] - tIm * im[k + j + halfM];
                const vIm = tRe * im[k + j + halfM] + tIm * re[k + j + halfM];

                // Butterfly
                re[k + j]         = uRe + vRe;
                im[k + j]         = uIm + vIm;
                re[k + j + halfM] = uRe - vRe;
                im[k + j + halfM] = uIm - vIm;

                // Advance twiddle: t *= w
                const newTRe = tRe * wRe - tIm * wIm;
                const newTIm = tRe * wIm + tIm * wRe;
                tRe = newTRe;
                tIm = newTIm;
            }
        }
    }

    // Pack into object array matching the existing contract shape
    /** @type {{re: number, im: number}[] & {paddedLength: number}} */
    const X = /** @type {any} */ (new Array(N));
    for (let i = 0; i < N; i++) {
        X[i] = { re: re[i], im: im[i] };
    }
    X.paddedLength = N;
    return X;
}
