declare module 'torrent-stream' {
  import { EventEmitter } from 'events';
  import { Readable } from 'stream';

  interface TorrentFile {
    name: string;
    path: string;
    length: number;
    createReadStream(opts?: { start?: number; end?: number }): Readable;
    select(): void;
    deselect(): void;
  }

  interface TorrentEngine extends EventEmitter {
    files: TorrentFile[];
    destroy(cb?: () => void): void;
    remove(keepBuf?: boolean, cb?: () => void): void;
  }

  interface TorrentOptions {
    connections?: number;
    uploads?: number;
    tmp?: string;
    path?: string;
    verify?: boolean;
    dht?: boolean;
    tracker?: boolean;
    trackers?: string[];
  }

  function torrentStream(target: string | Buffer, opts?: TorrentOptions): TorrentEngine;
  export default torrentStream;
}
