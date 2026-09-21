"""Generate one local Indonesian voice reply with Piper."""

import math
import sys
import wave
from array import array
from pathlib import Path

from piper import PiperVoice


def baby_robot_effect(raw: Path, output: Path) -> None:
    """Brighten an Indonesian Piper voice with mild robotic modulation."""
    with wave.open(str(raw), 'rb') as source:
        channels, width, rate = source.getnchannels(), source.getsampwidth(), source.getframerate()
        frames = source.readframes(source.getnframes())
    if channels != 1 or width != 2:
        output.write_bytes(raw.read_bytes())
        return
    samples = array('h')
    samples.frombytes(frames)
    if sys.byteorder != 'little':
        samples.byteswap()
    if not samples:
        output.write_bytes(raw.read_bytes())
        return
    # A small speed/pitch rise preserves words while making the voice youthful.
    speed = 1.18
    result = array('h')
    echo_delay = max(1, round(rate * .024))
    for index in range(math.ceil(len(samples) / speed)):
        position = index * speed
        left = min(int(position), len(samples) - 1)
        right = min(left + 1, len(samples) - 1)
        value = samples[left] + (samples[right] - samples[left]) * (position - left)
        # Subtle ring modulation and one short echo give a robot texture.
        carrier = .87 + .13 * math.sin(2 * math.pi * 31 * index / rate)
        echo = result[index - echo_delay] * .12 if index >= echo_delay else 0
        result.append(max(-32768, min(32767, round(value * carrier * .86 + echo))))
    if sys.byteorder != 'little':
        result.byteswap()
    with wave.open(str(output), 'wb') as target:
        target.setnchannels(channels)
        target.setsampwidth(width)
        target.setframerate(rate)
        target.writeframes(result.tobytes())


def main() -> None:
    model, output = sys.argv[1:3]
    style = sys.argv[3] if len(sys.argv) > 3 else 'baby-robot'
    text = sys.stdin.read()
    voice = PiperVoice.load(model)
    raw = Path(output).with_name('speech-raw.wav') if style == 'baby-robot' else Path(output)
    with wave.open(str(raw), 'wb') as audio:
        voice.synthesize_wav(text, audio)
    if style == 'baby-robot':
        baby_robot_effect(raw, Path(output))
        raw.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
