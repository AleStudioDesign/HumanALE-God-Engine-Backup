$ErrorActionPreference = 'Stop'

$voicePython = $env:HUMANALE_PYTHON_PATH
if (-not $voicePython) { $voicePython = $env:DUDIDAM_PYTHON_PATH }
if (-not $voicePython) {
    $voicePython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}
if (-not (Test-Path -LiteralPath $voicePython)) {
    throw 'Python 3.12 tidak ditemukan. Atur HUMANALE_PYTHON_PATH (atau DUDIDAM_PYTHON_PATH lama) ke python.exe lalu jalankan ulang.'
}

& $voicePython -m pip install --user 'faster-whisper==1.2.1' 'piper-tts==1.4.1'
if ($LASTEXITCODE -ne 0) { throw 'Pemasangan runtime suara gagal.' }

@'
import os
from pathlib import Path
from faster_whisper import WhisperModel
from huggingface_hub import hf_hub_download

root = Path(os.environ['LOCALAPPDATA']) / 'HumanALE god egine' / 'voice-models'
root.mkdir(parents=True, exist_ok=True)
WhisperModel('base', device='cpu', compute_type='int8', download_root=str(root))
voice_dir = root / 'piper'
prefix = 'id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx'
for name in (prefix, prefix + '.json'):
    hf_hub_download('rhasspy/piper-voices', name, repo_type='model', local_dir=str(voice_dir))
print('Suara dan dikte Bahasa Indonesia siap di:', root)
'@ | & $voicePython -
if ($LASTEXITCODE -ne 0) { throw 'Model Bahasa Indonesia gagal diunduh.' }
