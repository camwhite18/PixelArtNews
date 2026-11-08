// Small sound effects for retro TV mode, synthesised on the fly.
let ctx: AudioContext | null = null;

/** The clunk of an old TV's channel knob. Call from a click or key press. */
export function knobClick() {
  try {
    ctx ??= new AudioContext();
    const length = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4 * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    src.connect(filter).connect(ctx.destination);
    src.start();
  } catch {
    // No Web Audio: silent.
  }
}
