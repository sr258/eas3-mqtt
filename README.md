# EAS 3-MQTT-Gateway

Das EAS 3-MQTT-Gateway ist eine [NodeJS](https://nodejs.org/)-Anwendung, die den
Zustand (z.B. Heizraumtemperatur oder Abbrandstatus) einer elektronischen
Abbrandsteuerung vom Typ "[Brunner EAS
3](https://www.brunner.de/haustechnik/steuerungen/eas-3)" bei einem MQTT-Broker
veröffentlicht. Dadurch können diese Daten in einem Home-Automation-System wie
[Home Assistant](https://www.home-assistant.io/) verwendet werden.

**Dieses Projekt hat keine Verbindung zur [Ulrich Brunner
GmbH](https://www.brunner.de/) und wird von dieser auch nicht unterstützt. Der
Hersteller veröffentlicht keine Dokumentation des verwendeten Protokolls und das
Gateway beruht auf Analysen des Verhaltens des Geräts.**

## Funktionsweise

Wenn die EAS 3 mit dem WLAN verbunden ist, sendet sie sekündlich
UDP-Broadcast-Pakete auf Port 45454, die alle fünf Sekunden den aktuellen Status
enthalten. Das Gateway horcht auf diese Pakete, parst sie und gibt dann die
enthaltenen Informationen per MQTT auf dem Topic `stove/eas3_X/sensors` wieder
aus. Außerdem werden per MQTT Autodiscovery-Informationen ausgegeben, damit Home
Assistant die Daten besser visualisieren kann.

`X` im Topic entspricht der Nummer des EAS 3-Geräts, wie es intern konfiguriert
wurde. Wenn nur ein Gerät vorhanden ist, ist dies 0. Bei mehreren Geräten werden
dann weitere Nummern verwenden.

Das Gateway ist unidirektional und nur lesend, weshalb das Gateway keinesfalls
die Steuerung beeinflussen sollte, d.h.:

- Es werden nur Daten vom EAS 3 ausgelesen.
- Es ist nicht möglich, Konfigurationswerte am EAS 3 zu ändern.

Unterstützte Informationen:

- Heizraum-Temperatur (in °C)
- Abbrand-Status (Aus, Tür offen, Abbrand Start, Abbrand Stufe 1, Abbrand Stufe
  2, Abbrand Stufe 3, Abbrand Stufe 4, Abbrand Ende, Fehler; bei einem dem
  Gateway nicht bekannten Statuswert: Unbekannt)
- Verlängerter Abbrand (an / aus)
- Öko-Modus (an / aus)
- Drosselklappen-Betrieb (an / aus)
- Nachlege-Hinweis (0-4)

Zur Bedeutung dieser Informationen, siehe das EAS 3-Benutzerhandbuch.

## Kompatibilität

Das Gateway wurde mit der EAS 3-Firmware 3.44 getestet.

## Voraussetzungen

- Es wird **NodeJS 20** benötigt.
- Die EAS 3 muss bereits über die BRUNNEREAS3-App mit dem **WLAN** verbunden
worden sein und in der App müssen Daten angezeigt werden.
- Es muss ein **MQTT-Broker** laufen und fertig konfiguriert sein.

## Ausführen

### Einfaches Starten

1. Die Dependencies mit `npm ci` installieren.
2. Das [Gateway konfigurieren](#konfiguration).
3. Das Gateway mit `npm start` starten.

### Als Daemon mit pm2 ausführen

Mit der oben angeführten Methode, wird das Gateway nicht erneut gestartet, wenn
es durch einen Absturz oder Reboot der Maschine beendet wurde. Um dies
sicherzustellen, kann beispielsweise [pm2](https://pm2.keymetrics.io/) verwendet
werden:

1. `npm install pm2 -g` (einmalig).
2. Die Dependencies mit `npm ci` installieren (einmalig).
3. Das [Gateway konfigurieren](#konfiguration).
4. `pm2 start src/eas3.js`

Das Gateway läuft dann als daemon und wird dann 24/7 ausgeführt.

Folgende Kommandos können z.B. verwendet werden, um den Daemon zu kontrollieren:

- `pm2 ps` - Zeigt die aktuell laufenden pm2-Prozesse an
- `pm2 log eas3` - Zeigt das Log an (über mehrere Ausführungen hinweg).
- `pm2 stop eas3` - Stoppt den Prozess mit dem Namen `eas3`. Wenn `pm2 ps` einen
  anderen Namen ausgegeben hat, muss dieser stattdessen verwendet werden.
- `pm2 delete eas3` - Löscht den Prozess mit dem Namen `eas3`. Wenn `pm2 ps`
  einen anderen Namen ausgegeben hat, muss dieser stattdessen verwendet werden.

## Konfiguration

Das Gateway kann über folgende Umgebungsvariablen konfiguriert werden:

| Umgebungsvariable | Beschreibung | Verwendung | Beispiel(e) | Standardwert wenn leer | 
| -  | - | - | - | - |
| MQTT_HOST | Hostname des MQTT-Brokers. Ohne diesen Wert beendet sich das Gateway mit einer Fehlermeldung. | verpflichtend | 192.168.188.200<br>localhost | |
| MQTT_PORT | Port des MQTT-Brokers | optional | 1883 | 1883 |
| MQTT_USERNAME | Benutzername eines Nutzers auf dem MQTT-Broker. Nichts angeben, um ohne Authentisierung zu arbeiten. | optional | myusername | |
| MQTT_PASSWORD | Passwort eines Nutzers auf dem MQTT-Broker. Nichts angeben, um ohne Authentisierung zu arbeiten. | optional | mypassword | | 
| MQTT_AUTODISCOVERY_FREQUENCY | Wie häufig das Gateway Autodiscovery-Informationen an den MQTT-Broker verschickt. Das Gateway schickt (pro EAS 3-Gerät) bei jedem X-ten Status-Paket die Autodiscovery-Nachricht. Normalerweise verschickt die EAS 3 alle fünf Sekunden ein Status-Paket, d.h. der Standardwert 10 entspricht etwa 50 Sekunden. Ungültige Werte (kleiner als 1 oder keine Zahl) werden durch den Standardwert ersetzt. | optional | 10 | 10 |
| MQTT_AUTODISCOVERY_DISABLED | Deaktiviert das Senden von Autodiscovery-Informationen. Sinnvoll wenn ein anderes System als Home Assistant verwendet wird. | optional | true<br>false | |
| EAS3_BROADCAST_PORT | Der UDP-Port, auf den EAS3-Broadcasts gesendet werden. | optional | 45454 | 45454 |
| EAS3_MQTT_DEVICE_PREFIX | Präfix für das Gerät im MQTT-Broker | optional | prefix_ | eas3_ |
| EAS3_UDP_LOG_FILE | Pfad einer Datei, in die jedes empfangene UDP-Paket (auch unbekannte) als JSON Lines angehängt wird: Zeitstempel, Absender, Länge, Text und Hex-Payload. Für Reverse Engineering, siehe [UDP-Pakete mitschneiden](#udp-pakete-mitschneiden). | optional | /var/log/eas3-udp.jsonl | deaktiviert |
| DEBUG | Konfiguriert die Debug-Ausgabe | optional | eas3-mqtt-gateway<br>* | |

Die Umgebungsvariablen können in einer `.env`-Datei liegen oder normal als
Umgebungsvariablen übergeben werden. Es gibt eine Beispiel-`.env`-Datei unter
[`example.env`](/example.env). 

Wenn die `.env`-Datei verwendet werden soll:

1. `example.env` in `.env` kopieren.
2. Die Konfigurationswerte in `.env` entsprechend den eigenen Bedingungen
   anpassen.
3. Das Gateway ohne weitere Parameter starten.

Wenn die Umgebungsvariablen per CLI übergeben werden sollen (Linux):

- Das Gateway per `MQTT_HOST=localhost MQTT_USERNAME=myusername npm start`
  starten.

## Debugging

Das Gateway verwendet das NPM-Package
[`debug`](https://www.npmjs.com/package/debug), um Debug-Informationen
auszugeben. Diese können angezeigt werden, indem die Anwendung mit der
Umgebungsvariable `DEBUG=eas3-mqtt-gateway` gestartet wird (Linux):

```sh
DEBUG=eas3-mqtt-gateway npm start
```

Dann wird die Debug-Ausgabe des Gateways selber angezeigt. Es können auch die
Ausgaben anderer Packages angezeigt werden. Dafür `DEBUG=*` setzen.

## UDP-Pakete mitschneiden

Für das Reverse Engineering kann das Gateway alle empfangenen UDP-Pakete
unverändert mitschneiden, auch solche, die es nicht versteht. Dazu
`EAS3_UDP_LOG_FILE` auf einen Dateipfad setzen. Pro Paket wird eine Zeile JSON
angehängt (Zeitstempel, Absender, Länge, `text` als Latin-1 und `hex`). Die
Datei wird nicht rotiert und wächst unbegrenzt.

Beispiele zur Auswertung mit [`jq`](https://jqlang.org/):

```sh
# Alle Pakete, die keine bekannten Status-Pakete sind
jq -c 'select(.text | startswith("<bdle") | not)' eas3-udp.jsonl

# Häufigkeit der Pakete nach Anfang des Textes
jq -r '.text[:12]' eas3-udp.jsonl | sort | uniq -c | sort -rn
```

## Beispiel-Automation in Home Assistant

Die folgende Home Assistant-Automation drosselt die Soll-Temperatur der
Heizkörperthermostate im Wohnzimmer, wenn der Ofen geheizt wird, damit die
Zentralheizung ausgeschaltet wird und der Raum nicht überheizt. Nach zwei
Stunden wird die normale Soll-Temperatur eingestellt, damit die Zentralheizung
nahtlos übernimmt, wenn der Ofen nach einigen Stunden abkühlt.

```yaml
alias: Kachelofen an -> Heizung aus
description: ""
triggers:
  - trigger: numeric_state
    entity_id:
      - sensor.kachelofen_eas_3_heizraum_temperatur
    for:
      hours: 0
      minutes: 0
      seconds: 30
    above: 40
conditions:
  - condition: state
    entity_id: sensor.kachelofen_eas_3_abbrand_status
    state: Abbrand Start
actions:
  - action: climate.set_temperature
    metadata: {}
    data:
      temperature: 15
    target:
      device_id: <ID_DES_RAUMES>
  - delay:
      hours: 2
      minutes: 0
      seconds: 0
      milliseconds: 0
  - action: climate.set_temperature
    metadata: {}
    data:
      temperature: 21.5
    target:
      device_id: <ID_DES_RAUMES>
mode: single
```

## Beschränkungen

Die EAS 3 sendet Broadcast-Pakete, deren Bedeutung aktuell unbekannt ist, und
die deshalb ignoriert werden. Das EAS 3 scheint von der BRUNNEREAS3-App per
Remote Procedure Call aufgerufen zu werden. Was hier genau passiert ist
unbekannt, weshalb die Features der App nicht verwendet werden können.

## Quellen / Anerkennung

Das Gateway beruht auf den Informationen aus dem [Thread #761 des ioBroker
GitHub Issue Tracker](https://github.com/ioBroker/AdapterRequests/issues/761)
von [JR-Home](https://github.com/JR-Home) und
[Draygv2](https://github.com/Draygv2).

Die Liste der Heizeinsätze wurde dem EAS 3-Benutzerhandbuch entnommen.
