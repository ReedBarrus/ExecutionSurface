// test_signal.js
// Deterministic synthetic signal generator for end-to-end pipeline testing.

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function gaussianNoise(rng, std = 1) {
    // Box-Muller transform
    const u1 = Math.max(rng(), 1e-12);
    const u2 = Math.max(rng(), 1e-12);
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const z0 = mag * Math.cos(2 * Math.PI * u2);
    return z0 * std;
}

function sine(freq, t, amp = 1, phase = 0) {
    return amp * Math.sin(2 * Math.PI * freq * t + phase);
}

function inRange(t, start, end) {
    return t >= start && t < end;
}

function buildSegmentLabel(t) {
    if (inRange(t, 0, 3)) return "baseline";
    if (inRange(t, 3, 5)) return "novelty_enter";
    if (inRange(t, 5, 7)) return "frequency_shift";
    if (inRange(t, 7, 8)) return "dropout";
    if (inRange(t, 8, 10)) return "burst_return";
    return "out_of_range";
}

function makeTestSignal(options = {}) {
    const {
        durationSec = 10,
        fs = 256,
        seed = 42,
        noiseStd = 0.03,
        stream_id,
        source_id = "synthetic_fixture_v1",
        channel = "ch0",
        modality = "voltage",
        units = "arb",
        amplitudeScale = 1.0,
    } = options;

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
        throw new Error("durationSec must be a positive finite number");
    }
    if (!Number.isFinite(fs) || fs <= 0) {
        throw new Error("fs must be a positive finite number");
    }

    const rng = mulberry32(seed);
    const N = Math.floor(durationSec * fs);

    const timestamps = [];
    const values = [];
    const annotations = [];

    for (let i = 0; i < N; i++) {
        const t = i / fs;

        let x = 0;

        // Segment A: 0-3s baseline
        // 8 Hz strong + 20 Hz weaker
        if (inRange(t, 0, 3)) {
            x += sine(8, t, 1.0 * amplitudeScale);
            x += sine(20, t, 0.45 * amplitudeScale);
        }

        // Segment B: 3-5s novelty enters
        // Keep baseline and add 40 Hz
        else if (inRange(t, 3, 5)) {
            x += sine(8, t, 1.0 * amplitudeScale);
            x += sine(20, t, 0.45 * amplitudeScale);
            x += sine(40, t, 0.65 * amplitudeScale);
        }

        // Segment C: 5-7s frequency shift
        // Replace 20 Hz with 24 Hz
        else if (inRange(t, 5, 7)) {
            x += sine(8, t, 1.0 * amplitudeScale);
            x += sine(24, t, 0.45 * amplitudeScale);
        }

        // Segment D: 7-8s dropout
        // Mostly missing / invalid samples with occasional baseline resumption
        else if (inRange(t, 7, 8)) {
            const localT = t - 7;
            if (localT < 0.5) {
                annotations.push({
                    t,
                    segment: "dropout",
                    event: "dropped_sample",
                });
                continue; // omit this sample entirely to create a real time gap
            } else {
                x += sine(8, t, 1.0 * amplitudeScale);
                x += sine(20, t, 0.45 * amplitudeScale);
            }
        }

        // Segment E: 8-10s burst + return
        else if (inRange(t, 8, 10)) {
            x += sine(8, t, 1.0 * amplitudeScale);
            x += sine(20, t, 0.45 * amplitudeScale);

            // deterministic pulse bursts
            const burstCenters = [8.35, 8.9, 9.45];
            for (const c of burstCenters) {
                const dt = t - c;
                const sigma = 0.02;
                x += 1.2 * Math.exp(-(dt * dt) / (2 * sigma * sigma));
            }
        }

        // light deterministic noise everywhere except explicit NaN block
        x += gaussianNoise(rng, noiseStd);

        timestamps.push(t);
        values.push(x);
    }

    const segments = [
        {
            name: "baseline",
            start: 0,
            end: 3,
            expected_features: ["8Hz strong", "20Hz weaker"],
        },
        {
            name: "novelty_enter",
            start: 3,
            end: 5,
            expected_features: ["8Hz strong", "20Hz weaker", "40Hz new tone"],
        },
        {
            name: "frequency_shift",
            start: 5,
            end: 7,
            expected_features: ["8Hz strong", "24Hz replaces 20Hz"],
        },
        {
            name: "dropout",
            start: 7,
            end: 8,
            expected_features: ["timestamp gap", "gap handling", "partial return"],
        },
        {
            name: "burst_return",
            start: 8,
            end: 10,
            expected_features: ["baseline return", "transient pulse bursts"],
        },
    ];

    const expectedEvents = [
        {
            kind: "novelty",
            start: 3,
            end: 5,
            detail: "40Hz component appears",
        },
        {
            kind: "frequency_shift",
            start: 5,
            end: 7,
            detail: "20Hz component replaced by 24Hz",
        },
        {
            kind: "dropout",
            start: 7,
            end: 7.5,
            detail: "timestamp gap / dropped sample block",
        },
        {
            kind: "transient",
            start: 8,
            end: 10,
            detail: "pulse bursts on top of baseline",
        },
    ];

    return {
        signal: {
            stream_id,
            source_id,
            channel,
            modality,
            timestamps,
            values,
            meta: {
                units,
                Fs_nominal: fs,
                generator: "test_signal.js",
                seed,
                durationSec,
                noiseStd,
            },
        },
        truth: {
            fs,
            durationSec,
            sampleCount: values.length,
            rawNominalCount: N,
            segments,
            expectedEvents,
            annotationHint: "Use expectedEvents and segments to compare pipeline outputs against known truth.",
        },
        helpers: {
            labelAtTime: buildSegmentLabel,
        },
    };
}

export { makeTestSignal };