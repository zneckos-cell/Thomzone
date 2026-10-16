# Thomzone

Webbplatsen använder vanlig HTML, CSS och JavaScript utan byggsteg.

## Sidflöde

`script.js` förladdar Home, Gaming, Tech, Projects och About samt bilderna som används i sidornas innehåll. Första sidan visas direkt medan resten hämtas. Bakgrundsvideon och menyn ligger kvar; enbart sidinnehållet byts med en 360 ms glidanimation.

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
