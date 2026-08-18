import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faFileImport, faLayerGroup, faPlus } from "@fortawesome/free-solid-svg-icons";
import CreateSongModal from "@/features/song/modals/CreateSongModal";
import { useTournamentHeaderSongsManageMenu } from "@/features/song/hooks/useTournamentHeaderSongsManageMenu";
import { btnPrimary } from "@/styles/buttonStyles";

type Props = {
  tournamentId: number;
  songsVersion: number;
  refreshSongs: () => void;
};

export default function TournamentHeaderSongsManageMenu({
  tournamentId,
  songsVersion,
  refreshSongs,
}: Props) {
  const {
    menuOpen,
    addInGroupOpen,
    addInNewGroupOpen,
    loadingSongsMeta,
    songGroups,
    selectedGroupName,
    fileInputRef,
    setAddInGroupOpen,
    setAddInNewGroupOpen,
    openMenu,
    closeMenu,
    openAddInGroup,
    openAddInNewGroup,
    triggerImport,
    handleCreateSong,
    handleBulkImport,
  } = useTournamentHeaderSongsManageMenu({
    tournamentId,
    songsVersion,
    refreshSongs,
  });

  return (
    <>
      <CreateSongModal
        open={addInGroupOpen}
        onClose={() => setAddInGroupOpen(false)}
        initialGroup={selectedGroupName}
        onCreate={handleCreateSong}
      />
      <CreateSongModal
        open={addInNewGroupOpen}
        onClose={() => setAddInNewGroupOpen(false)}
        existingGroups={songGroups}
        onCreate={handleCreateSong}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleBulkImport}
      />

      <div className="relative">
        <button
          type="button"
          onClick={menuOpen ? closeMenu : openMenu}
          className={`flex items-center gap-2 ${btnPrimary}`}
        >
          Manage
          <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={closeMenu} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded shadow-lg border border-gray-200 min-w-[180px]">
              <button
                type="button"
                disabled={!selectedGroupName || loadingSongsMeta}
                onClick={openAddInGroup}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faPlus} className="text-primary-dark" />
                Add song
              </button>
              <button
                type="button"
                disabled={loadingSongsMeta}
                onClick={openAddInNewGroup}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faLayerGroup} className="text-primary-dark" />
                New pack
              </button>
              <button
                type="button"
                disabled={loadingSongsMeta}
                onClick={triggerImport}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faFileImport} className="text-primary-dark" />
                Import
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
