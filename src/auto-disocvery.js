import { heizeinsaetze } from './stoves.js';

export const generateDeviceId = (easNumber, devicePrefix) => `${devicePrefix}${easNumber}`;

const generateDevice = (easNumber, heizeinsatzNummer, devicePrefix) => ({
    "identifiers": [generateDeviceId(easNumber, devicePrefix)],
    "name": "Kachelofen EAS 3",
    "model": heizeinsaetze[heizeinsatzNummer],
    "manufacturer": "Brunner"
});

export const generateAutoDiscoveryConfiguration = (easNumber, heizeinsatzNummer, devicePrefix) => {
    const autoDiscoveryConfigurations = {};

    const deviceId = generateDeviceId(easNumber, devicePrefix);

    autoDiscoveryConfigurations[
        `homeassistant/sensor/stove_${deviceId}_heizraumTemperatur/config`] =
    {
        "device_class": "temperature",
        "device": generateDevice(easNumber, heizeinsatzNummer),
        "name": "Heizraum-Temperatur",
        "state_topic": `stove/${deviceId}/sensors`,
        "unit_of_measurement": "°C",
        "unique_id": `stove_${deviceId}_heizraumTemperatur`,
        "value_template": "{{ value_json.heizraumTemperatur}}"
    };
    autoDiscoveryConfigurations[
        `homeassistant/binary_sensor/stove_${deviceId}_verlaengerterAbbrand/config`] =
    {
        "name": "verlängerter Abbrand",
        "device": generateDevice(easNumber, heizeinsatzNummer),
        "state_topic": `stove/${deviceId}/sensors`,
        "unique_id": `stove_${deviceId}_verlaengerterAbbrand`,
        "value_template": "{{ value_json.verlaengerterAbbrand}}"
    };
    autoDiscoveryConfigurations[
        `homeassistant/binary_sensor/stove_${deviceId}_oeko/config`] =
    {
        "name": "Öko-Modus",
        "device": generateDevice(easNumber, heizeinsatzNummer),
        "state_topic": `stove/${deviceId}/sensors`,
        "unique_id": `stove_${deviceId}_oeko`,
        "value_template": "{{ value_json.oeko}}"
    };
    autoDiscoveryConfigurations[
        `homeassistant/binary_sensor/stove_${deviceId}_drosselklappenBetrieb/config`] =
    {
        "name": "Drosselklappen-Betrieb",
        "device": generateDevice(easNumber, heizeinsatzNummer),
        "state_topic": `stove/${deviceId}/sensors`,
        "unique_id": `stove_${deviceId}_drosselklappenBetrieb`,
        "value_template": "{{ value_json.drosselklappenBetrieb}}"
    };
    autoDiscoveryConfigurations[
        `homeassistant/number/stove_${deviceId}_nachlegeHinweis/config`] =
    {
        "name": "Nachlege-Hinweis",
        "device": generateDevice(easNumber, heizeinsatzNummer),
        "min": 0,
        "max": 4,
        "step": 1,
        "state_topic": `stove/${deviceId}/sensors`,
        "unique_id": `stove_${deviceId}_nachlegeHinweis`,
        "value_template": "{{ value_json.nachlegeHinweis}}"
    };
    autoDiscoveryConfigurations[
        `homeassistant/sensor/stove_${deviceId}_abbrandStatus/config`] =
    {
        "device_class": "enum",
        "device": generateDevice(easNumber, heizeinsatzNummer),
        "name": "Abbrand-Status",
        "state_topic": `stove/${deviceId}/sensors`,
        "unique_id": `stove_${deviceId}_abbrandStatus`,
        "options": [
            "Tür offen",
            "Abbrand Start",
            "Abbrand Stufe 1",
            "Abbrand Stufe 2",
            "Abbrand Stufe 3",
            "Abbrand Stufe 4",
            "Abbrand Ende",
            "Aus",
            "Fehler"
        ],
        "value_template": "{{ value_json.abbrandStatus}}"
    };
    return autoDiscoveryConfigurations;
};
