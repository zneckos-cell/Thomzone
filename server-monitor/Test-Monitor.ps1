$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Thomzone-Status.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
$functions = $ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]}, $true)
foreach ($name in @('Publish-Status', 'Get-SatisfactoryStatus')) {
    Invoke-Expression ($functions | Where-Object Name -eq $name).Extent.Text
}
# Stub GitHub transport; no credentials or real network writes.
$script:exists = $false
$script:written = $null
function Invoke-RestMethod {
    param($Uri, $Headers, $Method, $TimeoutSec, $ContentType, $Body)
    if ($Uri -ne 'https://api.github.com/repos/zneckos-cell/Thomzone-status/contents/server-status.json') { throw 'Wrong destination' }
    if ($Method -eq 'Get') {
        if ($script:exists) { return @{sha='existing-sha'} }
        $exception = New-Object System.Exception('Missing file')
        $exception | Add-Member NoteProperty Response ([pscustomobject]@{StatusCode=404})
        throw $exception
    }
    $script:written = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json
}
$sampleJson = '{"satisfactory":{"status":"online","players":0,"maxPlayers":4}}'
Publish-Status -Json $sampleJson -GitHubToken 'test-secret'
if ($script:written.sha) { throw 'Create must omit sha' }
$decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($script:written.content))
if ($decoded -ne $sampleJson -or $decoded.Contains('test-secret')) { throw 'Incorrect public payload' }
$script:exists = $true
Publish-Status -Json $sampleJson -GitHubToken 'test-secret'
if ($script:written.sha -ne 'existing-sha') { throw 'Update must include latest sha' }
function Invoke-RestMethod { throw 'Mock network failure' }
$failed = $false
try { Publish-Status -Json $sampleJson -GitHubToken 'test-secret' } catch { $failed = $true }
if (-not $failed) { throw 'Upload failure was swallowed' }
function Invoke-GameApi {
    param($FunctionName, $Token)
    if ($FunctionName -eq 'HealthCheck') { return @{Health='healthy'} }
    return @{ServerGameState=@{NumConnectedPlayers=0;PlayerLimit=4;IsGameRunning=$true}}
}
$state = Get-SatisfactoryStatus -Token 'test-secret'
if ($state.status -ne 'online' -or $state.players -ne 0 -or $state.maxPlayers -ne 4) { throw 'Zero player regression' }
function Invoke-GameApi { throw 'Mock timeout' }
$state = Get-SatisfactoryStatus -WarningAction SilentlyContinue
if ($state.status -ne 'unknown' -or $null -ne $state.players) { throw 'Timeout regression' }
'PASS: GitHub create/update/failure, payload isolation, zero players, and timeout.'
