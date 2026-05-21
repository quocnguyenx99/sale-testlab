import { createHash } from 'crypto';
import * as fs from 'fs';

export async function calculateFileHash(fileContent: string): Promise<string> {
    return new Promise((resolve) => {
        const hash = createHash('sha256');
        hash.update(fileContent);
        resolve(hash.digest('hex'));
    });
}

export async function calculateFileHashStream(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', err => reject(err));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}