import 'dotenv/config';

import { createSocket } from 'dgram'; // for UDP
import { connect } from 'mqtt';
import debug from 'debug';

import { processMessage } from './message-processor.js';

const logger = debug('eas3-mqtt-gateway');

console.log("Brunner EAS 3 Kachelofen MQTT Gateway version 1.0 started...");

const config = {
    eas3BroadcastPort: process.env.EAS3_BROADCAST_PORT ? Number.parseInt(process.env.EAS3_BROADCAST_PORT) : 45454,
    mqttHost: process.env.MQTT_HOST,
    mqttPort: process.env.MQTT_PORT ? Number.parseInt(process.env.MQTT_PORT) : 1883,
    mqttUsername: process.env.MQTT_USERNAME || undefined,
    mqttPassword: process.env.MQTT_PASSWORD || undefined,
    mqttAutodiscoveryFrequency: process.env.MQTT_AUTODISCOVERY_FREQUENCY ? Number.parseInt(process.env.MQTT_AUTODISCOVERY_FREQUENCY) : 10,
    mqttAutodiscoveryDisabled: process.env.MQTT_AUTODISCOVERY_DISABLED == "true",
    devicePrefix: process.env.EAS3_MQTT_DEVICE_PREFIX || "eas3_"
}

const mqttClient = connect({
    host: config.mqttHost,
    port: config.mqttPort,
    username: config.mqttUsername,
    password: config.mqttPassword
});

let mqttConnected = mqttClient.connected;

mqttClient.on("error", (error) => {
    console.error("MQTT error:");
    console.error(error);
});

mqttClient.on("connect", () => {
    logger("MQTT connected");
    mqttConnected = true;
});

mqttClient.on("disconnect", () => {
    logger("MQTT disconnected");
    mqttConnected = false;
});

// Create udp server socket object.
const server = createSocket("udp4");

// Port Nummer der Brunner EAS3 Abbrand Steuerung
server.bind(config.eas3BroadcastPort);

// When udp server receives message.
server.on("message", function (message) {
    const messageString = message.toString();
    logger("Received UDP broadcast", messageString);
    if (mqttConnected) {
        processMessage(messageString, mqttClient, config);
    } else {
        logger("MQTT not connected, message not processed");
    }
});

// When udp server started and listening.
server.on('listening', function () {
    // Get and print udp server listening ip address and port number in log console. 
    const address = server.address();
    console.log('UDP Server started and listening to broadcasts on ' + address.address + ":" + address.port);
});