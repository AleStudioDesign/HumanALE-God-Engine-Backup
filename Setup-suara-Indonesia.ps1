$ErrorActionPreference = 'Stop'

$bootstrapPython = $env:HUMANALE_PYTHON_PATH
if (-not $bootstrapPython) { $bootstrapPython = $env:DUDIDAM_PYTHON_PATH }
if (-not $bootstrapPython) {
    $bootstrapPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}
if (-not (Test-Path -LiteralPath $bootstrapPython) -and -not $env:HUMANALE_PYTHON_PATH -and -not $env:DUDIDAM_PYTHON_PATH) {
    $installedPython = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($installedPython) { $bootstrapPython = $installedPython.Source }
}
if (-not (Test-Path -LiteralPath $bootstrapPython)) {
    throw 'Python 3.12 tidak ditemukan. Atur HUMANALE_PYTHON_PATH (atau DUDIDAM_PYTHON_PATH lama) ke python.exe lalu jalankan ulang.'
}
$voicePython = $bootstrapPython
if (-not $env:HUMANALE_PYTHON_PATH -and -not $env:DUDIDAM_PYTHON_PATH) {
    $runtime = Join-Path $env:LOCALAPPDATA 'HumanALE god egine\voice-runtime'
    $voicePython = Join-Path $runtime 'Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $voicePython)) {
        & $bootstrapPython -m venv $runtime
        if ($LASTEXITCODE -ne 0) { throw 'Lingkungan suara Indonesia gagal dibuat.' }
    }
}

& $voicePython -m pip install 'faster-whisper==1.2.1' 'piper-tts==1.4.1'
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
