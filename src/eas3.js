import 'dotenv/config';

import { createSocket } from 'dgram'; // for UDP
import { connect } from 'mqtt';
import debug from 'debug';

import { processMessage } from './message-processor.js';
import { createUdpLogger } from './udp-logger.js';

const logger = debug('eas3-mqtt-gateway');

console.log("Brunner EAS 3 Kachelofen MQTT Gateway version 1.0 started...");

const DEFAULT_AUTODISCOVERY_FREQUENCY = 10;

function parseAutodiscoveryFrequency(value) {
    if (!value) {
        return DEFAULT_AUTODISCOVERY_FREQUENCY;
    }
    const frequency = Number.parseInt(value);
    if (!Number.isInteger(frequency) || frequency < 1) {
        console.error(`Invalid MQTT_AUTODISCOVERY_FREQUENCY "${value}", using ${DEFAULT_AUTODISCOVERY_FREQUENCY} instead.`);
        return DEFAULT_AUTODISCOVERY_FREQUENCY;
    }
    return frequency;
}

const config = {
    eas3BroadcastPort: process.env.EAS3_BROADCAST_PORT ? Number.parseInt(process.env.EAS3_BROADCAST_PORT) : 45454,
    mqttHost: process.env.MQTT_HOST,
    mqttPort: process.env.MQTT_PORT ? Number.parseInt(process.env.MQTT_PORT) : 1883,
    mqttUsername: process.env.MQTT_USERNAME || undefined,
    mqttPassword: process.env.MQTT_PASSWORD || undefined,
    mqttAutodiscoveryFrequency: parseAutodiscoveryFrequency(process.env.MQTT_AUTODISCOVERY_FREQUENCY),
    mqttAutodiscoveryDisabled: process.env.MQTT_AUTODISCOVERY_DISABLED == "true",
    devicePrefix: process.env.EAS3_MQTT_DEVICE_PREFIX || "eas3_",
    udpLogFile: process.env.EAS3_UDP_LOG_FILE || undefined
}

if (!config.mqttHost) {
    console.error("MQTT_HOST is not set. Please configure the hostname of the MQTT broker.");
    process.exit(1);
}

const udpLogger = createUdpLogger(config.udpLogFile);
if (udpLogger) {
    console.log(`Logging all received UDP datagrams to ${config.udpLogFile}`);
}

const mqttClient = connect({
    host: config.mqttHost,
    port: config.mqttPort,
    username: config.mqttUsername,
    password: config.mqttPassword
});

mqttClient.on("error", (error) => {
    console.error("MQTT error:");
    console.error(error);
});

mqttClient.on("connect", () => {
    logger("MQTT connected");
});

// "close" is emitted on every connection loss; "disconnect" would only be
// emitted when the broker sends a MQTT 5 DISCONNECT packet.
mqttClient.on("close", () => {
    logger("MQTT disconnected");
});

// Create udp server socket object.
const server = createSocket("udp4");

server.on("error", (error) => {
    console.error("UDP server error:");
    console.error(error);
    server.close();
    process.exit(1);
});

// Port Nummer der Brunner EAS3 Abbrand Steuerung
server.bind(config.eas3BroadcastPort);

// When udp server receives message.
server.on("message", function (message, remoteInfo) {
    // Log the raw datagram first, independent of MQTT and of whether we understand it.
    udpLogger?.log(message, remoteInfo);
    const messageString = message.toString();
    logger("Received UDP broadcast", messageString);
    if (mqttClient.connected) {
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