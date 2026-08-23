import type { DirectoryLikeHandle, EntryHandle, FileLikeHandle } from "@/features/song/model/songImport/filesystem";
import { parseSimfile, toSongPath } from "@/features/song/model/songImport/stepmaniaParser";
import type { ScanResult, ScannedSong } from "@/features/song/model/songImport/types";

/**
 * Finding the songs under the folder somebody picked.
 *
 * The rules are the ones `itgmania-songs-to-json.mjs` walked a disk by, moved
 * onto directory handles: a folder is a song when it holds an `.ssc` or an
 * `.sm`, `.ssc` wins when both are there, folders whose name starts with `.`
 * are ignored, and nothing below a song folder is looked at. Whether the
 * picked folder is a `Songs` directory or one pack is decided the same way it
 * always was — if any direct child is already a song folder, the picked folder
 * is the pack.
 *
 * A song is parsed as it is found, so the confirmation that follows describes
 * what was actually read and the import never has to walk the folder twice.
 */

const NOTE_FILE_EXTENSIONS = [".ssc", ".sm"];

type ScanProgress = {
  packs: number;
  songs: number;
  charts: number;
};

function extension(name: string): string {
  const dot = name.lastIndexOf(".");

  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

async function entriesOf(directory: DirectoryLikeHandle): Promise<EntryHandle[]> {
  const entries: EntryHandle[] = [];
  for await (const entry of directory.values()) entries.push(entry);

  return entries;
}

/** Sub-directories, hidden ones left out, in the order the script read them. */
async function readDirectories(directory: DirectoryLikeHandle): Promise<DirectoryLikeHandle[]> {
  const entries = await entriesOf(directory);

  return entries
    .filter((entry): entry is DirectoryLikeHandle => entry.kind === "directory" && !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The simfile of a song folder: `.ssc` when there is one, otherwise `.sm`. */
export async function findPreferredNoteFile(directory: DirectoryLikeHandle): Promise<FileLikeHandle | null> {
  const files = (await entriesOf(directory))
    .filter((entry): entry is FileLikeHandle => entry.kind === "file")
    .filter((entry) => NOTE_FILE_EXTENSIONS.includes(extension(entry.name)));

  return (
    files.find((file) => extension(file.name) === ".ssc") ??
    files.find((file) => extension(file.name) === ".sm") ??
    null
  );
}

async function hasSongFolderChildren(children: DirectoryLikeHandle[]): Promise<boolean> {
  for (const child of children) {
    if (await findPreferredNoteFile(child)) return true;
  }

  return false;
}

/** One pack, or every pack of a `Songs` directory. */
export async function resolvePacks(root: DirectoryLikeHandle): Promise<DirectoryLikeHandle[]> {
  const children = await readDirectories(root);

  return (await hasSongFolderChildren(children)) ? [root] : children;
}

/**
 * Reads the whole of a picked folder.
 *
 * `onProgress` exists because a full `Songs` directory is thousands of files
 * and the person is looking at a dialog while it is read. Nothing is written
 * anywhere: this answers with what the folder holds, and the import that
 * follows is built from the answer.
 */
export async function scanSongsDirectory(
  root: DirectoryLikeHandle,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  const packs = await resolvePacks(root);
  const songs: ScannedSong[] = [];
  const warnings: string[] = [];
  const packNames: string[] = [];
  let charts = 0;

  for (const pack of packs) {
    packNames.push(pack.name);

    for (const folder of await readDirectories(pack)) {
      const noteFile = await findPreferredNoteFile(folder);
      if (!noteFile) continue;

      const songPath = toSongPath(pack.name, folder.name);

      try {
        const file = await noteFile.getFile();
        const parsed = parseSimfile(noteFile.name, await file.text());

        songs.push({
          pack: pack.name,
          folder: folder.name,
          songPath,
          artist: parsed.artist,
          charts: parsed.charts,
        });
        charts += parsed.charts.length;
      } catch {
        /* One unreadable simfile is one song missing from the pool, not a
           failed import: the folder may have moved, or the file may be
           something other than what its name says. */
        warnings.push(`${songPath}: ${noteFile.name} could not be read and was skipped.`);
      }

      onProgress?.({ packs: packNames.length, songs: songs.length, charts });
    }

    onProgress?.({ packs: packNames.length, songs: songs.length, charts });
  }

  return { rootName: root.name, packs: packNames, songs, warnings };
}
