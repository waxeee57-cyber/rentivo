# PreToolUse guard - blocks dangerous Bash/PowerShell commands.
# File-based so the $ variables are never expanded by an outer shell (no nested-quote / "=" error).
# Input: Claude Code passes the hook JSON on stdin.
# Output: exit 2 = block, exit 0 = allow.

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

    $payload = $raw | ConvertFrom-Json

    # tool_input may be an object (new Claude Code) or a JSON string (old) - handle both.
    $toolInput = $payload.tool_input
    if ($toolInput -is [string]) { $toolInput = $toolInput | ConvertFrom-Json }
    $cmd = $toolInput.command
    if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }
}
catch {
    # If the input cannot be parsed, do not block (fail-open) - never stall real work.
    exit 0
}

# Dangerous patterns: recursive delete, or forced delete of .env / .git.
$dangerous = @(
    'rm\s+-rf',
    'Remove-Item.*-Recurse.*-Force.*\.(env|git)',
    'Remove-Item.*\.(env|git)\b.*-Recurse.*-Force'
)

foreach ($pattern in $dangerous) {
    if ($cmd -match $pattern) {
        [Console]::Error.WriteLine("BLOCKED: dangerous command pattern: $pattern")
        exit 2
    }
}

exit 0
