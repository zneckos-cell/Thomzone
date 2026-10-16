# Thomzone - status och GitHub-publicering

## Installation pa Windows-VM:n

1. Stoppa det gamla statusskriptet med Ctrl+C.
2. Packa upp paketet i C:\satisfactory-server\WebsiteUpdateStatus och ersatt programfilerna. Behall din befintliga api-token.txt. Paketet innehaller inga riktiga tokenfiler.
3. Skapa en fine-grained personal access token pa https://github.com/settings/personal-access-tokens/new
   - Resource owner: zneckos-cell
   - Repository access: Only select repositories -> Thomzone-status
   - Repository permissions: Contents -> Read and write
   - Metadata: Read-only (automatiskt)
   - Valj utgangsdatum och kom ihag att byta token innan dess.
4. Dubbelklicka pa Start-Status.cmd. Forsta gangen oppnas github-token.txt i Anteckningar. Ersatt PASTE_GITHUB_TOKEN_HERE med GitHub-tokenen, spara och stang.
5. Leta efter GitHub upload OK i konsolen. Kontroll och uppladdning sker direkt, sedan var 900:e sekund. Lat fonstret vara oppet. Ingen separat minutkontroll kors.

Satisfactory-tokenen ligger i api-token.txt. GitHub-tokenen ligger i github-token.txt. De ar olika nycklar. Inga nycklar skrivs till resultatfilen eller laddas upp. .gitignore undantar bagge tokenfilerna. Dela eller publicera aldrig hela skriptmappen med tokenfilerna kvar.

## Destination

Endast det nyskapade statusdokumentet laddas upp till:
https://github.com/zneckos-cell/Thomzone-status/blob/main/server-status.json

Ett tomt repo kan initieras av forsta uppladdningen. GitHub-tokenen behover Contents: Read and write for just Thomzone-status. Git eller en lokal kopia av repot behovs inte. Repots standardbranch ska vara main, som vid skapandet. Vid befintlig fil hamtas senaste SHA innan uppdatering. Vid misslyckad uppladdning sparas resultatet lokalt och nasta forsok sker efter nasta kontroll. Kor bara en instans av skriptet.

Hemsidans uppdaterade script.js laser:
https://raw.githubusercontent.com/zneckos-cell/Thomzone-status/main/server-status.json

Hemsidan hamtar vid oppning och var femtonde minut medan fliken ar synlig. Vid aterkomst till fliken hamtas status om femton minuter passerat. Aldersetiketten uppdateras lokalt varje minut. Status aldre an 30 minuter visas som Status outdated. GitHubs cache kan ge extra fordrojning. Hemsidans kod maste ocksa publiceras med ert vanliga GitHub Pages-flode; statusuppladdningen publicerar inte hemsidans kod.

## Status

Online betyder att API:t svarar. Med giltig Satisfactory-token hamtas spelarantal och om en varld ar laddad. Idle betyder ingen varld laddad. Unknown betyder att API:t inte kunde kontrolleras, till exempel vid uppstart eller laddning; det ar inte bekraftat offline. Valheim och Minecraft markeras coming-soon tills deras kontroller finns.

API-anropen mot spelet ar endast HealthCheck och QueryServerState via https://127.0.0.1:7777/api/v1. Serverns sjalvsignerade certifikat accepteras endast for dessa lokala anrop. GitHub-anrop anvander normal certifikatkontroll. Inga spelinstallningar eller sparfiler andras. Inga inkommande portar behover oppnas for uppladdningen.

## Felsokning

401: GitHub-tokenen ar ogiltig eller har gatt ut.
403/404: Kontrollera valt repo, Contents: Read and write, samt att tokenen tillhor ratt konto.
409/422: Kontrollera repots branchregler och att endast ett statusskript kors.
Network error: Kontrollera VM:ns internetanslutning till api.github.com.

Skriptet maste startas igen efter VM-omstart. Dubbelklicka pa samma Start-Status.cmd.

Lokal kontroll utan publicering:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Thomzone-Status.ps1 -Watch -TokenFile .\api-token.txt

Tester utan natverksanrop eller riktiga nycklar:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Monitor.ps1

Referenser:
https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
https://github.com/robtme/satisfactory-server/wiki/Official-API-Docs
