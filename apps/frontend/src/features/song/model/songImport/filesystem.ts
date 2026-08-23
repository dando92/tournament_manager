/**
 * The folder a person granted, and nothing else.
 *
 * The importer never learns an operating-system path and never uploads a file:
 * it holds the handles the directory picker gave it, reads the simfiles it
 * finds under them, and sends the pool it made. These interfaces are the part
 * of the File System Access API the scan actually uses — declared here because
 * the DOM library this project compiles against does not carry them, and
 * because a test can then hand the scan a folder made of plain objects.
 */

export interface FileLikeHandle {
  kind: "file";
  name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
}

export interface DirectoryLikeHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FileLikeHandle | DirectoryLikeHandle>;
}

export type EntryHandle = FileLikeHandle | DirectoryLikeHandle;

/** The browser cannot open a directory picker at all. */
export class DirectoryPickerUnsupportedError extends Error {
  constructor() {
    super("This browser cannot open a folder. Use a Chromium-based browser to import songs from disk.");
    this.name = "DirectoryPickerUnsupportedError";
  }
}

type DirectoryPicker = (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<DirectoryLikeHandle>;

function directoryPicker(): DirectoryPicker | null {
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;

  return typeof picker === "function" ? picker.bind(window) : null;
}

export function supportsDirectoryPicker(): boolean {
  return directoryPicker() !== null;
}

/**
 * Asks for the folder to import from.
 *
 * Answers `null` when the person closes the picker: changing your mind is not
 * an error, and the flow simply ends where it started.
 */
export async function pickSongsDirectory(): Promise<DirectoryLikeHandle | null> {
  const picker = directoryPicker();
  if (!picker) throw new DirectoryPickerUnsupportedError();

  try {
    return await picker({ id: "tournament-manager-songs", mode: "read" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;

    throw error;
  }
}
