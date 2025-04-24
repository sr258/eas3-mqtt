import debug from 'debug';

const logger = debug('eas3-mqtt-gateway');

import { generateAutoDiscoveryConfiguration, generateDeviceId } from './auto-disocvery.js'

const broadcastRegex = /<bdle eas="(\d+)".+stat="(\d+)">(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\-?\d+);(\d+);(\d+);(\d+);(\d+);<\/bdle>/;

// We only send auto discovery messages every 10th message (or configuration
// value config.mqttAutodiscoveryFrequency)
let discoveryCounter = 0;

export const processMessage = (message, mqttClient, config) => {
    const resultArray = broadcastRegex.exec(message);
    if (resultArray != null) {
        const fullData =
        {
            heizraumTemperatur: parseInt(resultArray[15]),
            verlaengerterAbbrand: parseInt(resultArray[3]),
            oeko: parseInt(resultArray[4]),
            drosselklappenBetrieb: parseInt(resultArray[5]),
            displayHelligkeit: parseInt(resultArray[6]),
            intensitaetSummer: parseInt(resultArray[7]),
            nachlegeHinweis: parseInt(resultArray[8]),
            abbrandStatus: parseInt(resultArray[2]),
            heizeinsatz: parseInt(resultArray[16]),
            version: parseInt(resultArray[10]),
            versionParameter: parseInt(resultArray[11]),
            easNumber: parseInt(resultArray[1])
        };

        logger('Parsed EAS 3 data', fullData);

        let abbrandStatusText;
        switch (fullData.abbrandStatus) {
            case 0:
                abbrandStatusText = "Tür offen";
                break;
            case 1:
                abbrandStatusText = "Abbrand Start";
                break;
            case 2:
                abbrandStatusText = "Abbrand Stufe 1";
                break;
            case 3:
                abbrandStatusText = "Abbrand Stufe 2";
                break;
            case 4:
                abbrandStatusText = "Abbrand Stufe 3";
                break;
            case 5:
                abbrandStatusText = "Abbrand Stufe 4";
                break;
            case 6:
                abbrandStatusText = "Abbrand Ende";
                break;
            case 7:
                abbrandStatusText = "Aus";
                break;
            case 8:
                abbrandStatusText = "Fehler";
                break;
        }

        if (!config.mqttAutodiscoveryDisabled) {
            if ((discoveryCounter % config.mqttAutodiscoveryFrequency) == 0) {
                discoveryCounter = 0;
                const adc = generateAutoDiscoveryConfiguration(fullData.easNumber, fullData.heizeinsatz, config.devicePrefix);
                logger('Publishing auto-discovery information');
                logger(adc);
                for (const topic in adc) {
                    mqttClient.publish(topic, JSON.stringify(adc[topic]));
                }
            }
            discoveryCounter++;
        }

        const mqttTopic = `stove/${generateDeviceId(fullData.easNumber, config.devicePrefix)}/sensors`;
        const mqttData = JSON.stringify(
            {
                heizraumTemperatur: fullData.heizraumTemperatur,
                verlaengerterAbbrand: fullData.verlaengerterAbbrand ? "ON" : "OFF",
                oeko: fullData.oeko ? "ON" : "OFF",
                drosselklappenBetrieb: fullData.verlaengerterAbbrand ? "ON" : "OFF",
                nachlegeHinweis: fullData.nachlegeHinweis,
                abbrandStatus: abbrandStatusText
            }
        );
        logger('Publishing data to MQTT', mqttTopic, mqttData);
        mqttClient.publish(mqttTopic, mqttData);

    }
    else {
        // unknown message
    }
}