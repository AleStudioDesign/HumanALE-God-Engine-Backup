"""Generate one local Indonesian voice reply with Piper."""

import sys
import wave

from piper import PiperVoice


def main() -> None:
    model, output = sys.argv[1:3]
    text = sys.stdin.read()
    voice = PiperVoice.load(model)
    with wave.open(output, 'wb') as audio:
        voice.synthesize_wav(text, audio)


if __name__ == '__main__':
    main()
