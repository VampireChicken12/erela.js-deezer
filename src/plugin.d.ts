import { Manager, Plugin, UnresolvedTrack, UnresolvedQuery } from "erela.js";
export declare class Deezer extends Plugin {
  private _search;
  private manager;
  private readonly functions;
  private readonly options;
  constructor(options: DeezerOptions);
  load(manager: Manager): void;
  private search;
  private getAlbumTracks;
  private getPlaylistTracks;
  private getTrack;
  private static convertToUnresolved;
}
export interface DeezerOptions {
  /** Amount of pages to load, each page having 100 tracks. */
  playlistLimit?: number;
  /** Amount of pages to load, each page having 50 tracks. */
  albumLimit?: number;
  /**
   * Whether to convert UnresolvedTracks to Track. Defaults to false.
   * **Note: This is** ***not*** **recommended as it spams YouTube and takes a while if a large playlist is loaded.**
   */
  convertUnresolved?: boolean;
}
export interface Result {
  tracks: UnresolvedQuery[];
  name?: string;
}

export interface Album {
  name: string;
  tracks: AlbumTracks;
}

export interface AlbumTracks {
  data: DeezerTrack[];
}

export interface Playlist {
  tracks: PlaylistTracks;
  title: string;
}

export interface PlaylistTracks {
  data: [DeezerTrack];
}

export interface DeezerTrack {
  artist: {
    name: string;
  };
  title: string;
  duration: number;
}

export interface SearchResult {
  exception?: {
    severity: string;
    message: string;
  };
  loadType: string;
  playlist?: {
    duration: number;
    name: string;
  };
  tracks: UnresolvedTrack[];
}