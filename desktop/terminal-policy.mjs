const SECRET_PATTERNS=[
  /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GH_TOKEN|GEMINI_API_KEY|GOOGLE_API_KEY|XAI_API_KEY|DEEPSEEK_API_KEY)\s*[:=]\s*[^\s]+/gi,
  /(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9._~+\/-]+/gi,
  /\b(sk-[A-Za-z0-9_-]{8,})\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\b(?:sk-ant-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g,
  /\b(password|passwd|token|secret|api[_ -]?key)\s*[:=]\s*([^\s]+)/gi
];

export function redactSecrets(value=''){
 let text=String(value??'');
 for(const pattern of SECRET_PATTERNS){
  text=text.replace(pattern,(match,prefix)=>{
   if(typeof prefix==='string'&&/Bearer/i.test(prefix))return prefix+'[REDACTED]';
   if(typeof prefix==='string'&&/^(password|passwd|token|secret|api[_ -]?key)$/i.test(prefix))return prefix+'=[REDACTED]';
   return '[REDACTED]';
  });
 }
 return text;
}

const BLOCK=[
 /(?:^|\s)(?:reg\s+(?:save|export)|cmdkey\s+\/list|vaultcmd|mimikatz)(?:\s|$)/i,
 /(?:chrome|edge|firefox).*(?:password|login data|cookies)/i,
 /(?:Set-MpPreference|sc(?:\.exe)?\s+stop\s+(?:WinDefend|Sense)|netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off)/i,
 /(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod).*(?:token|secret|password|api[_ -]?key)/i,
 /(?:Remove-Item|del|erase|rmdir|rd)\b[^\r\n]*(?:\b[A-Z]:\\\b|\\Windows\\|\\Users\\)[^\r\n]*(?:-Recurse|\/s)/i,
 /(?:format\s+[A-Z]:|diskpart\b|bcdedit\b[^\r\n]*\/delete)/i
];

const CONFIRM=[
 /^\s*git\s+(?:push|reset|clean|checkout\s+--\s+\.)\b/i,
 /^\s*npm\s+publish\b/i,
 /^\s*(?:Remove-Item|del|erase|rmdir|rd)\b/i,
 /^\s*(?:Stop-Process|taskkill)\b/i,
 /^\s*winget\s+(?:install|uninstall|upgrade)\b/i,
 /^\s*(?:reg|reg\.exe)\s+(?:add|delete|import)\b/i,
 /^\s*(?:sc|sc\.exe|net\s+(?:start|stop))\b/i,
 /^\s*(?:Set-Service|Start-Service|Stop-Service|Restart-Service)\b/i,
 /^\s*(?:shutdown|restart-computer|stop-computer)\b/i
];

const SHELL_COMPOSITION=/(?:;|&&|\|\||(?<!\|)\|(?!\|)|(?<!&)\&(?!&)|[<>]|\$\(|`)/;

const SAFE=[
 /^\s*git\s+(?:status|diff|log|show|branch(?:\s+--show-current)?|rev-parse)\b/i,
 /^\s*(?:node|npm|npx|python|py|pip|git|gh|claude|codex|agent|gemini)\s+--version\b/i,
 /^\s*npm\s+(?:test|run\s+(?:build|test|verify|lint|typecheck))\b/i,
 /^\s*(?:Get-ChildItem|Get-Location|Get-Content|Test-Path|Resolve-Path)\b/i,
 /^\s*(?:dir|where|echo|type|cd|pwd)\b/i
];

export function classifyCommand(command=''){
 const value=String(command??'').trim();
 if(!value||value.length>2000||/[\r\n]/.test(value))return {category:'BLOCK',reason:'Command harus satu baris dan tidak kosong.'};
 if(BLOCK.some(re=>re.test(value)))return {category:'BLOCK',reason:'Command berisiko terhadap credential, keamanan Windows, atau filesystem luas.'};
 if(CONFIRM.some(re=>re.test(value)))return {category:'CONFIRM',reason:'Command dapat mengubah project atau sistem dan memerlukan persetujuan pengguna.'};
 if(SHELL_COMPOSITION.test(value))return {category:'CONFIRM',reason:'Command memakai chaining, pipe, redirection, atau ekspansi shell dan memerlukan persetujuan pengguna.'};
 if(SAFE.some(re=>re.test(value)))return {category:'SAFE',reason:'Command termasuk operasi baca, inspeksi, test, atau build yang diizinkan.'};
 return {category:'CONFIRM',reason:'Command belum termasuk daftar aman; minta konfirmasi sebelum menjalankan.'};
}

export function shouldPersistHistory(command=''){
 return !/(password|passwd|token|secret|api[_ -]?key|authorization)/i.test(String(command));
}
