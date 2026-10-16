#requires -Version 5.1
<#
Run on the Satisfactory VM. Only calls HealthCheck and QueryServerState.
No server configuration is changed. Output contains no credentials.
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$Port = 7777,
    [ValidateRange(15, 3600)][int]$IntervalSeconds = 900,
    [string]$OutputPath,
    [switch]$Watch,
    [switch]$AskForToken,
    [string]$TokenFile,
    [string]$GitHubTokenFile
)

$ErrorActionPreference = 'Stop'
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
# Resolve this after parameter binding: some Windows PowerShell hosts do not
# populate PSScriptRoot while evaluating parameter default expressions.
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $monitorDirectory = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($monitorDirectory)) {
        $monitorDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
    if ([string]::IsNullOrWhiteSpace($monitorDirectory)) {
        throw 'Cannot locate script directory. Start this script using Start-Status.cmd.'
    }
    $OutputPath = Join-Path $monitorDirectory 'server-status.json'
}
# The server's self-signed certificate is accepted ONLY for this loopback request.
# Use a compiled delegate so certificate validation also works off the PS thread.
if (-not ('ThomzoneLoopbackTls' -as [type])) {
    Add-Type -TypeDefinition @'
using System.Net.Security;
public static class ThomzoneLoopbackTls {
    public static readonly RemoteCertificateValidationCallback Validate =
        (sender, certificate, chain, errors) => true;
}
'@
}

function Invoke-GameApi {
    param([string]$FunctionName, [string]$Token)
    $request = [System.Net.HttpWebRequest]::Create("https://127.0.0.1:$Port/api/v1")
    $request.Method = 'POST'
    $request.ContentType = 'application/json; charset=utf-8'
    $request.Timeout = 8000
    $request.ReadWriteTimeout = 8000
    $request.AllowAutoRedirect = $false
    $request.Proxy = $null
    $request.ServerCertificateValidationCallback = [ThomzoneLoopbackTls]::Validate
    if ($Token) { $request.Headers['Authorization'] = "Bearer $Token" }
    $requestData = @{}
    if ($FunctionName -eq 'HealthCheck') { $requestData.ClientCustomData = '' }
    $payload = @{ function = $FunctionName; data = $requestData } | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $request.ContentLength = $bytes.Length
    $response = $null
    $stream = $null
    $reader = $null
    try {
        $stream = $request.GetRequestStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Dispose()
        $stream = $null
        $response = $request.GetResponse()
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $result = $reader.ReadToEnd() | ConvertFrom-Json
        if ($result.errorCode) {
            if ($FunctionName -eq 'HealthCheck') {
                throw "HealthCheck API error: $($result.errorCode). $($result.errorMessage)"
            }
            throw 'API returned an error.'
        }
        return $result.data
    } finally {
        if ($reader) { $reader.Dispose() }
        if ($stream) { $stream.Dispose() }
        if ($response) { $response.Dispose() }
        $request.Abort()
    }
}

function Publish-Status {
    param([string]$Json, [string]$GitHubToken)
    # Fixed destination and file: never upload the surrounding directory.
    $uri = 'https://api.github.com/repos/zneckos-cell/Thomzone-status/contents/server-status.json'
    $headers = @{
        Authorization = "Bearer $GitHubToken"
        Accept = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
        'User-Agent' = 'Thomzone-Status-Monitor'
    }
    $existing = $null
    try {
        $existing = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -TimeoutSec 20
    } catch {
        if ($null -eq $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) { throw }
        # A missing file (including an empty repository) is created by PUT.
    }
    $body = @{
        message = 'Update game server status'
        content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Json))
    }
    if ($existing.sha) { $body.sha = $existing.sha }
    $null = Invoke-RestMethod -Uri $uri -Headers $headers -Method Put `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))) -TimeoutSec 20
}

function Get-SatisfactoryStatus {
    param([string]$Token)
    $entry = [ordered]@{
        status = 'unknown'
        source = 'automatic'
        checkedAt = [DateTime]::UtcNow.ToString('o')
        players = $null
        maxPlayers = $null
        health = $null
        message = 'Status unavailable: API unreachable, starting, or loading a world.'
    }
    try {
        $health = Invoke-GameApi -FunctionName 'HealthCheck'
        if ($health.Health -notin @('healthy', 'slow')) { throw 'Unexpected health response.' }
        $entry.status = 'online'
        $entry.health = $health.Health
        $entry.message = 'API reachable. Player count needs an API token.'
    } catch {
        # A timeout does not prove that the game server is offline.
        # HealthCheck carries no token. Keep diagnostics local, out of public JSON.
        Write-Warning ('Local HealthCheck failed: ' + $_.Exception.GetBaseException().Message)
        return $entry
    }
    if ($Token) {
        try {
            $state = (Invoke-GameApi -FunctionName 'QueryServerState' -Token $Token).ServerGameState
            if ($null -eq $state -or $null -eq $state.NumConnectedPlayers -or
                $null -eq $state.PlayerLimit -or $null -eq $state.IsGameRunning) {
                throw 'Unexpected server state response.'
            }
            $players = 0
            $limit = 0
            if (-not [int]::TryParse([string]$state.NumConnectedPlayers, [ref]$players) -or
                -not [int]::TryParse([string]$state.PlayerLimit, [ref]$limit) -or
                $players -lt 0 -or $limit -lt 1) { throw 'Invalid player count.' }
            $entry.players = $players
            $entry.maxPlayers = $limit
            $entry.message = 'Game running.'
            if (-not $state.IsGameRunning) {
                $entry.status = 'idle'
                $entry.message = 'Server reachable; no world loaded.'
            }
        } catch {
            $entry.message = 'API reachable; player count unavailable. Check token permissions or retry after loading.'
        }
    }
    return $entry
}

$tokenText = $null
$githubTokenText = $null
if ($GitHubTokenFile) {
    if (-not (Test-Path -LiteralPath $GitHubTokenFile -PathType Leaf)) {
        throw 'Missing github-token.txt. Create a fine-grained GitHub token for Thomzone-status with Contents: Read and write.'
    }
    $githubTokenText = [IO.File]::ReadAllText([IO.Path]::GetFullPath($GitHubTokenFile)).Trim()
    if ([string]::IsNullOrWhiteSpace($githubTokenText) -or $githubTokenText -eq 'PASTE_GITHUB_TOKEN_HERE' -or $githubTokenText -match '\s') {
        throw 'Paste your real GitHub token into github-token.txt (one line).'
    }
}
if ($AskForToken -and $TokenFile) {
    throw 'Use either AskForToken or TokenFile, not both.'
}
if ($TokenFile) {
    if (-not (Test-Path -LiteralPath $TokenFile -PathType Leaf)) {
        throw 'Token file missing. Copy api-token.example.txt to api-token.txt and paste the real API token into it.'
    }
    $tokenText = [IO.File]::ReadAllText([IO.Path]::GetFullPath($TokenFile)).Trim()
    if ([string]::IsNullOrWhiteSpace($tokenText) -or $tokenText -eq 'dudu1213') {
        throw 'Replace the example in api-token.txt with the real token generated by the Satisfactory server.'
    }
    if ($tokenText -match '\s') { throw 'Token file must contain one token on a single line.' }
}
if ($AskForToken) {
    $secret = Read-Host 'API token (hidden; kept in memory only)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { $tokenText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secret.Dispose()
    }
}

$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
    throw 'Output directory does not exist.'
}
Write-Host 'Thomzone local monitor. Press Ctrl+C to stop.'
Write-Host "Output: $OutputPath"
Write-Host "Interval: $IntervalSeconds seconds. First check runs now."
try {
    do {
        $status = Get-SatisfactoryStatus -Token $tokenText
        $document = [ordered]@{
            satisfactory = $status
            valheim = @{ status = 'coming-soon'; source = 'planned'; checkedAt = $null }
            minecraft = @{ status = 'coming-soon'; source = 'planned'; checkedAt = $null }
        }
        $temporaryPath = Join-Path $outputDirectory ([IO.Path]::GetRandomFileName())
        $backupPath = Join-Path $outputDirectory ([IO.Path]::GetRandomFileName())
        $json = $document | ConvertTo-Json -Depth 6
        try {
            [IO.File]::WriteAllText($temporaryPath, $json, (New-Object Text.UTF8Encoding($false)))
            if ([IO.File]::Exists($OutputPath)) {
                # Windows PowerShell 5.1 can marshal $null to an empty path.
                # Give File.Replace a real backup path instead.
                [IO.File]::Replace($temporaryPath, $OutputPath, $backupPath)
            } else { [IO.File]::Move($temporaryPath, $OutputPath) }
        } finally {
            if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath }
            if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath }
        }
        $count = 'unknown'
        if ($null -ne $status.players) { $count = "$($status.players)/$($status.maxPlayers)" }
        Write-Host "$($status.checkedAt) | $($status.status) | Players: $count | $($status.message)"
        if ($githubTokenText) {
            try {
                Publish-Status -Json $json -GitHubToken $githubTokenText
                Write-Host 'GitHub upload OK: zneckos-cell/Thomzone-status/server-status.json'
            } catch {
                $httpCode = 'network error'
                if ($_.Exception.Response) { $httpCode = [string][int]$_.Exception.Response.StatusCode }
                # Do not print exceptions containing authenticated request details.
                Write-Warning "GitHub upload failed ($httpCode). Check token expiry, repository access and Contents: Read and write. Next attempt on next check."
            }
        }
        if ($Watch) { Start-Sleep -Seconds $IntervalSeconds }
    } while ($Watch)
} finally { $tokenText = $null; $githubTokenText = $null }
