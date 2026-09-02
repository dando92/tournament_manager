import { useAccountInfoPage } from "@/features/auth/model/useAccountInfoPage";
import Select from "@/shared/components/ui/Select";
import { btnPrimary } from "@/styles/buttonStyles";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faPen, faCamera } from "@fortawesome/free-solid-svg-icons";

const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "Andorran", "Angolan", "Antiguan", "Argentine", "Armenian",
  "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian",
  "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian",
  "Botswanan", "Brazilian", "Bruneian", "Bulgarian", "Burkinabé", "Burundian", "Cabo Verdean",
  "Cambodian", "Cameroonian", "Canadian", "Central African", "Chadian", "Chilean", "Chinese",
  "Colombian", "Comorian", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech",
  "Danish", "Djiboutian", "Dominican", "Dutch", "Ecuadorian", "Egyptian", "Emirati",
  "Equatorial Guinean", "Eritrean", "Estonian", "Eswatini", "Ethiopian", "Fijian", "Finnish",
  "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian",
  "Guatemalan", "Guinean", "Guinea-Bissauan", "Guyanese", "Haitian", "Honduran", "Hungarian",
  "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian",
  "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Kiribati",
  "Korean", "Kosovar", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Lesotho",
  "Liberian", "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourgish", "Malagasy",
  "Malawian", "Malaysian", "Maldivian", "Malian", "Maltese", "Marshallese", "Mauritanian",
  "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Montenegrin",
  "Moroccan", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan",
  "Nigerian", "Nigerien", "North Korean", "North Macedonian", "Norwegian", "Omani",
  "Pakistani", "Palauan", "Palestinian", "Panamanian", "Papua New Guinean", "Paraguayan",
  "Peruvian", "Filipino", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan",
  "Saint Kitts and Nevis", "Saint Lucian", "Saint Vincentian", "Samoan", "San Marinese",
  "São Toméan", "Saudi", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean",
  "Singaporean", "Slovak", "Slovenian", "Solomon Islander", "Somali", "South African",
  "South Sudanese", "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swedish", "Swiss",
  "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Timorese", "Togolese", "Tongan",
  "Trinidadian", "Tunisian", "Turkish", "Turkmen", "Tuvaluan", "Ugandan", "Ukrainian",
  "Uruguayan", "Uzbek", "Vanuatuan", "Venezuelan", "Vietnamese", "Yemeni", "Zambian",
  "Zimbabwean",
];

function compressImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AccountInfoPage() {
  const {
    account,
    fileInputRef,
    editingProfile,
    playerName,
    nationality,
    grooveStatsApi,
    profilePicture,
    saving,
    savingPicture,
    setEditingProfile,
    setPlayerName,
    setNationality,
    setGrooveStatsApi,
    savePicture,
    saveProfile,
    cancelEdit,
  } = useAccountInfoPage();
  if (!account) return null;

  async function handlePictureChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    await savePicture(await compressImage(file, 256));
  }

  const Avatar = ({ size = "md" }: { size?: "md" | "lg" }) => {
    const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
    const iconSize = size === "lg" ? "text-2xl" : "text-xl";
    return (
      <div
        className={`relative ${dim} rounded-full bg-ui-selected border-2 border-ui-border shrink-0 cursor-pointer group overflow-hidden`}
        onClick={() => !savingPicture && fileInputRef.current?.click()}
        title="Change profile picture"
      >
        {profilePicture ? (
          <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <FontAwesomeIcon icon={faUser} className={`text-ui-text ${iconSize}`} />
          </div>
        )}
        {/* Camera overlay on hover */}
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {savingPicture ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FontAwesomeIcon icon={faCamera} className="text-white text-sm" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <h1 className="text-3xl font-bold text-ui-text mb-6">Account Info</h1>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePictureChange}
      />

      {/* Player Info — prominent card at top */}
      <div className="border border-ui-border rounded-lg bg-ui-surface overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-2 bg-ui-selected border-b border-ui-border">
          <div className="flex items-center gap-2 text-ui-text font-semibold text-sm">
            <FontAwesomeIcon icon={faUser} />
            <span>Player Info</span>
          </div>
          {!editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1.5 text-xs text-ui-text border border-ui-border rounded px-2 py-1 hover:bg-ui-raised hover:text-ui-text transition-colors"
            >
              <FontAwesomeIcon icon={faPen} />
              Edit
            </button>
          )}
        </div>

        <div className="px-4 py-3">
          {editingProfile ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 mb-1">
                <Avatar size="lg" />
                <span className="text-xs text-ui-text-mute italic">Click to change picture</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ui-text-mute">Player name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player name..."
                  className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ui-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ui-text-mute">Nationality</label>
                <Select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                >
                  <option value="">— Select nationality —</option>
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ui-text-mute">GrooveStats API Key</label>
                <input
                  type="text"
                  value={grooveStatsApi}
                  onChange={(e) => setGrooveStatsApi(e.target.value)}
                  placeholder="Enter GrooveStats API key..."
                  className="border rounded px-3 py-1.5 text-sm font-mono w-full focus:outline-none focus:ring-2 focus:ring-ui-accent"
                />
              </div>
              <div className="flex flex-row gap-2 mt-1">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className={`text-sm ${btnPrimary}`}
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-sm text-ui-text-mute hover:underline px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <Avatar size="md" />
              <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                <p className="font-bold text-lg text-ui-text leading-tight">
                  {account.player?.playerName || (
                    <span className="text-ui-text-mute italic font-normal text-base">No player name set</span>
                  )}
                </p>
                <p className="text-sm text-ui-text-mute">
                  {account.nationality || (
                    <button
                      onClick={() => setEditingProfile(true)}
                      className="text-ui-text-mute italic hover:text-ui-text-soft hover:underline"
                    >
                      No nationality — click to add
                    </button>
                  )}
                </p>
                <div className="mt-1">
                  <span className="text-xs text-ui-text-mute">GrooveStats API Key: </span>
                  <span className="text-xs font-mono text-ui-text-soft">
                    {account.grooveStatsApi || <span className="italic text-ui-text-mute">Not set</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account details */}
      <div className="bg-ui-raised rounded-lg p-6 flex flex-col gap-3">
        <div>
          <span className="text-sm text-ui-text-mute">Username</span>
          <p className="font-semibold">{account.username}</p>
        </div>
      </div>
    </div>
  );
}
