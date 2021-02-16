import {
  Manager,
  Plugin,
  TrackUtils,
  UnresolvedTrack,
  UnresolvedQuery,
  LoadType,
  SearchQuery,
} from "erela.js";
import Axios from "axios";

const BASE_URL = "https://api.deezer.com";
const REGEX = /^(?:https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?(track|album|playlist)\/(\d+)/;

const buildSearch = (
  loadType: LoadType,
  tracks: UnresolvedTrack[],
  error: string,
  name: string
): SearchResult => ({
  loadType: loadType,
  tracks: tracks ?? [],
  playlist: name
    ? {
        name,
        duration: tracks.reduce(
          (acc: number, cur: UnresolvedTrack) => acc + (cur.duration || 0),
          0
        ),
      }
    : null,
  exception: error
    ? {
        message: error,
        severity: "COMMON",
      }
    : null,
});

const check = (options: DeezerOptions) => {
  if (!options) throw new TypeError("DeezerOptions must not be empty.");
  if (
    typeof options.convertUnresolved !== "undefined" &&
    typeof options.convertUnresolved !== "boolean"
  )
    throw new TypeError('Deezer option "convertUnresolved" must be a boolean.');

  if (
    typeof options.playlistLimit !== "undefined" &&
    typeof options.playlistLimit !== "number"
  )
    throw new TypeError('Deezer option "playlistLimit" must be a number.');

  if (
    typeof options.albumLimit !== "undefined" &&
    typeof options.albumLimit !== "number"
  )
    throw new TypeError('Deezer option "albumLimit" must be a number.');
};

export class Deezer extends Plugin {
  private _search: (
    query: string | SearchQuery,
    requester?: unknown
  ) => Promise<SearchResult>;
  private manager: Manager;
  private readonly functions: Record<string, Function>;
  private readonly options: DeezerOptions;

  public constructor(options: DeezerOptions) {
    super();
    check(options);
    this.options = {
      ...options,
    };

    this.functions = {
      track: this.getTrack.bind(this),
      album: this.getAlbumTracks.bind(this),
      playlist: this.getPlaylistTracks.bind(this),
    };
  }

  public load(manager: Manager) {
    this.manager = manager;
    this._search = manager.search.bind(manager);
    manager.search = this.search.bind(this);
  }

  private async search(
    query: string | SearchQuery,
    requester?: unknown
  ): Promise<SearchResult> {
    const finalQuery = (query as SearchQuery).query || (query as string);
    const [, type, id] = finalQuery.match(REGEX) ?? [];

    if (type in this.functions) {
      try {
        const func = this.functions[type];

        if (func) {
          const data: Result = await func(id);
          const loadType =
            type === "track" ? "TRACK_LOADED" : "PLAYLIST_LOADED";
          const name = ["playlist", "album"].includes(type)
            ? data.name
              ? data.name
              : "Untitled"
            : null;

          const tracks = data.tracks
            .map((query) => {
              const track = TrackUtils.buildUnresolved(query, requester);

              if (this.options.convertUnresolved) {
                try {
                  track.resolve();
                } catch {
                  return null;
                }
              }

              return track;
            })
            .filter((track) => !!track);

          return buildSearch(loadType, tracks, null, name);
        }

        const msg =
          'Incorrect type for Deezer URL, must be one of "track", "album" or "playlist".';
        return buildSearch("LOAD_FAILED", null, msg, null);
      } catch (e) {
        return buildSearch(
          e.loadType ?? "LOAD_FAILED",
          null,
          e.message ?? null,
          null
        );
      }
    }

    return this._search(query, requester);
  }

  private async getAlbumTracks(id: string): Promise<Result> {
    const { data: album } = await Axios.get<Album>(`${BASE_URL}/album/${id}`);
    const tracks = album.tracks.data
      .map((item) => (item.title ? Deezer.convertToUnresolved(item) : null))
      .filter((item) => item !== null);

    return {
      tracks: this.options.albumLimit
        ? tracks.splice(0, this.options.albumLimit)
        : tracks,
      name: album.name ? album.name : "Untitled album",
    };
  }

  private async getPlaylistTracks(id: string): Promise<Result> {
    let { data: playlist } = await Axios.get<Playlist>(
      `${BASE_URL}/playlist/${id}`
    );
    const tracks = playlist.tracks.data
      .map((item) =>
        item.track.title ? Deezer.convertToUnresolved(item.track) : null
      )
      .filter((item) => item !== null);
    return {
      tracks: this.options.playlistLimit
        ? tracks.splice(0, this.options.playlistLimit)
        : tracks,
      name: playlist.name ? playlist.name : "Untitled playlist",
    };
  }

  private async getTrack(id: string): Promise<Result> {
    const { data } = await Axios.get<DeezerTrack>(`${BASE_URL}/track/${id}`);
    const track = Deezer.convertToUnresolved(data);
    return { tracks: [track] };
  }

  private static convertToUnresolved(track: DeezerTrack): UnresolvedQuery {
    if (!track)
      throw new ReferenceError("The Deezer track object was not provided");
    if (!track.artist)
      throw new ReferenceError("The track artist array was not provided");
    if (!track.title)
      throw new ReferenceError("The track title was not provided");
    if (typeof track.title !== "string")
      throw new TypeError(
        `The track name must be a string, received type ${typeof track.title}`
      );

    return {
      title: track.title,
      author: track.artist.name,
      duration: track.duration * 1000,
    };
  }
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
  name: string;
}

export interface PlaylistTracks {
  data: [
    {
      track: DeezerTrack;
    }
  ];
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
