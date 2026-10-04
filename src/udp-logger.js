import { createWriteStream } from 'fs';

// Writes every received UDP datagram as one JSON object per line (JSON Lines),
// so that the traffic of the EAS 3 can be analyzed later (e.g. with jq).
// Payloads are stored as hex (lossless) and as text (latin1, so that every byte
// maps to exactly one character and the text can be searched easily).
export const createUdpLogger = (filePath) => {
    if (!filePath) {
        return null;
    }

    const stream = createWriteStream(filePath, { flags: 'a' });
    stream.on('error', (error) => {
        console.error(`Could not write UDP log file ${filePath}:`);
        console.error(error);
    });

    return {
        log(message, remoteInfo) {
            stream.write(JSON.stringify({
                time: new Date().toISOString(),
                from: remoteInfo.address,
                port: remoteInfo.port,
                length: message.length,
                text: message.toString('latin1'),
                hex: message.toString('hex')
            }) + '\n');
        },
        close() {
            stream.end();
        }
    };
};
