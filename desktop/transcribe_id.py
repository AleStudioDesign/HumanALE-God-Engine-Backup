"""Transcribe one short local recording in Indonesian with a multilingual Whisper model."""

import json
import os
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    audio_path = Path(sys.argv[1])
    cache = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'Dudidam' / 'voice-models'
    cache.mkdir(parents=True, exist_ok=True)
    model = WhisperModel('base', device='cpu', compute_type='int8', download_root=str(cache))
    segments, info = model.transcribe(str(audio_path), language='id', beam_size=5, vad_filter=True, condition_on_previous_text=False)
    text = ' '.join(segment.text.strip() for segment in segments).strip()
    print(json.dumps({'text': text, 'language': info.language}, ensure_ascii=False))


if __name__ == '__main__':
    main()
