# Thomzone

Webbplatsen använder vanlig HTML, CSS och JavaScript utan byggsteg.

## Sidflöde

`script.js` förladdar HTML för Home, Gaming, Tech, Projects och About. Bilder och chattar laddas först när deras sida öppnas; galleribilder behåller lazy loading. Första sidan visas direkt medan övrig HTML hämtas. Bakgrundsvideon och menyn ligger kvar; enbart sidinnehållet byts med en 360 ms glidanimation.

Ordningen i listan `pages` i `script.js` bestämmer riktningen. Ett steg åt höger i menyn visar nästa sida från höger. Ett steg åt vänster visar den från vänster. Besökarens inställning för minskad rörelse stänger av glidanimationen.

Varje HTML-fil är fortfarande en fungerande ingång med egen adress, titel och beskrivning. Bakåt/framåt återställer scrollpositionen. Länkar som `gaming.html#valheim` fungerar även mellan sidorna. Om en sida inte kan hämtas försöker länken öppnas som en vanlig sida.

Redigera innehållet i respektive HTML-fil som tidigare. Gaming-sidans bildvisare, kopieringsknappar och chattar initieras i `script.js`. Sidornas egna script körs inte automatiskt vid ett sidbyte; lägg nya interaktiva funktioner i den gemensamma initieringen.

## Framtida galleri

En sida som inte finns i listan `pages` öppnas som en vanlig separat sida. Ett framtida `gallery.html` ligger därför automatiskt utanför flödet. En enskild länk kan också lämna flödet med `data-no-flow`, till exempel:

```html
<a href="gallery.html" data-no-flow>Bildgalleri</a>
```

## Lokal förhandsvisning

Förladdningen behöver HTTP/HTTPS. Att dubbelklicka på en HTML-fil och öppna den med `file://` aktiverar inte sidflödet.

Starta från denna mapp:

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Öppna sedan `http://127.0.0.1:8766/index.html`. På ett vanligt webbhotell fungerar filerna direkt utan särskild routing eller serverkonfiguration. Ladda upp HTML-filerna, CSS-filerna, `script.js`, bakgrundsfilerna, ikonerna samt mapparna `img` och `data` tillsammans. En omladdning hämtar en ny uppsättning sidor; under ett pågående besök återanvänds de förladdade sidornas innehåll.

## Spelstatus och bilder

Home och Gaming hämtar automatisk status från `https://raw.githubusercontent.com/zneckos-cell/Thomzone-status/main/server-status.json`. Hämtning sker vid öppning och var femtonde minut i synlig flik. Uppgifter äldre än 30 minuter visas som ”Status outdated”; misslyckad hämtning behåller tidigare uppgifter tills de föråldras. Saknad eller ogiltig status visas som otillgänglig. GitHubs cache kan ge ytterligare fördröjning.

`server-monitor/` innehåller PowerShell-skriptet för Windows-VM:n, startfil och installationsinstruktioner. Skriptet kontrollerar och laddar upp direkt vid start och sedan var femtonde minut. Endast statusdokumentet publiceras till det separata statusrepot. Tokenfiler undantas från Git. `data/server-status.json` är en lokal reservmall, inte hemsidans aktiva datakälla.

Introt på startsidan varar en sekund och kan hoppas över. Maskotbilderna på Home, Gaming och About har komprimerade WebP-versioner. PNG-originalen finns kvar för redigering.
