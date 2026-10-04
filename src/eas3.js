import 'dotenv/config';

import { createSocket } from 'dgram'; // for UDP
import { readFileSync } from 'fs';
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

// Status broadcasts of the EAS 3 are far smaller than this. Larger packets are
// dropped before they are parsed or logged.
const MAX_BROADCAST_LENGTH = 1024;

function parseAllowedSourceIps(value) {
    if (!value) {
        return undefined;
    }
    const ips = value.split(",").map((ip) => ip.trim()).filter((ip) => ip);
    return ips.length > 0 ? new Set(ips) : undefined;
}

// Removes control characters (e.g. terminal escape sequences) from untrusted
// data before it is written to the log.
const sanitizeForLog = (text) => text.replace(/[\x00-\x1f\x7f-\x9f]/g, "?");

const mqttTls = process.env.MQTT_TLS == "true";

const config = {
    eas3BroadcastPort: process.env.EAS3_BROADCAST_PORT ? Number.parseInt(process.env.EAS3_BROADCAST_PORT) : 45454,
    eas3BindAddress: process.env.EAS3_BIND_ADDRESS || undefined,
    eas3AllowedSourceIps: parseAllowedSourceIps(process.env.EAS3_ALLOWED_SOURCE_IPS),
    mqttHost: process.env.MQTT_HOST,
    mqttPort: process.env.MQTT_PORT ? Number.parseInt(process.env.MQTT_PORT) : (mqttTls ? 8883 : 1883),
    mqttTls,
    mqttCaFile: process.env.MQTT_CA_FILE || undefined,
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

if (!config.mqttTls && config.mqttPassword && !["localhost", "127.0.0.1", "::1"].includes(config.mqttHost)) {
    console.warn("MQTT_TLS is not enabled: the MQTT credentials are sent unencrypted.");
}

const udpLogger = createUdpLogger(config.udpLogFile);
if (udpLogger) {
    console.log(`Logging all received UDP datagrams to ${config.udpLogFile}`);
}

const mqttClient = connect({
    protocol: config.mqttTls ? "mqtts" : "mqtt",
    ca: config.mqttTls && config.mqttCaFile ? readFileSync(config.mqttCaFile) : undefined,
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
server.bind(config.eas3BroadcastPort, config.eas3BindAddress);

// When udp server receives message.
server.on("message", function (message, remoteInfo) {
    if (config.eas3AllowedSourceIps && !config.eas3AllowedSourceIps.has(remoteInfo.address)) {
        logger("Ignored UDP packet from source that is not allowed", remoteInfo.address);
        return;
    }
    // Log the raw datagram independent of MQTT and of whether we understand it,
    // but only from allowed sources.
    udpLogger?.log(message, remoteInfo);
    if (message.length > MAX_BROADCAST_LENGTH) {
        logger("Ignored oversized UDP packet", remoteInfo.address, message.length);
        return;
    }
    const messageString = message.toString();
    logger("Received UDP broadcast", remoteInfo.address, sanitizeForLog(messageString));
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