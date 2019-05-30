import { Stream } from "stream";
import eos from 'end-of-stream';

export default function StreamToBuffer(stream: Stream) {
    const buffers: Buffer[] = [];
    stream.on('data', buffers.push.bind(buffers));

    return new Promise<Buffer>((resolve, reject) => {
        eos(stream as any, (err) => {
            if (err) reject(err);

            switch (buffers.length) {
                case 0:
                    resolve(Buffer.allocUnsafe(0));
                    break;
                case 1:
                    resolve(buffers[0]);
                    break;
                default:
                    resolve(Buffer.concat(buffers));
            }
        });
    });
}