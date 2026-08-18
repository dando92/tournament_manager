import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { isLocalMode } from "@/features/auth/services/auth-mode";
import axios from "axios";
import { btnPrimary } from "@/styles/buttonStyles";
import { toast } from "react-toastify";
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
  if (isLocalMode()) return <Navigate to="/" replace />;
  const { state, actions } = useAuthContext();
  const { account } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [playerName, setPlayerName] = useState(account?.player?.playerName ?? "");
  const [nationality, setNationality] = useState(account?.nationality ?? "");
  const [grooveStatsApi, setGrooveStatsApi] = useState(account?.grooveStatsApi ?? "");
  const [profilePicture, setProfilePicture] = useState(account?.profilePicture ?? "");
  const [saving, setSaving] = useState(false);
  const [savingPicture, setSavingPicture] = useState(false);

  useEffect(() => {
    if (!editingProfile) {
      setPlayerName(account?.player?.playerName ?? "");
      setNationality(account?.nationality ?? "");
      setGrooveStatsApi(account?.grooveStatsApi ?? "");
      setProfilePicture(account?.profilePicture ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  if (!account) return null;

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !account) return;
    e.target.value = "";
    setSavingPicture(true);
    try {
      const base64 = await compressImage(file, 256);
      setProfilePicture(base64);
      await axios.patch(`user/${account.id}/profile`, { profilePicture: base64 });
      await actions.loadCurrentUser();
      toast.success("Profile picture updated.");
    } catch {
      toast.error("Failed to update profile picture.");
    } finally {
      setSavingPicture(false);
    }
  }

  async function saveProfile() {
    if (!account) return;
    setSaving(true);
    try {
      await axios.patch(`user/${account.id}/profile`, { playerName, nationality, grooveStatsApi });
      await actions.loadCurrentUser();
      toast.success("Profile updated.");
      setEditingProfile(false);
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingProfile(false);
    setPlayerName(account?.player?.playerName ?? "");
    setNationality(account?.nationality ?? "");
    setGrooveStatsApi(account?.grooveStatsApi ?? "");
  }

  const Avatar = ({ size = "md" }: { size?: "md" | "lg" }) => {
    const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
    const iconSize = size === "lg" ? "text-2xl" : "text-xl";
    return (
      <div
        className={`relative ${dim} rounded-full bg-primary-dark/10 border-2 border-primary-dark/30 shrink-0 cursor-pointer group overflow-hidden`}
        onClick={() => !savingPicture && fileInputRef.current?.click()}
        title="Change profile picture"
      >
        {profilePicture ? (
          <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <FontAwesomeIcon icon={faUser} className={`text-primary-dark ${iconSize}`} />
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
      <h1 className="text-3xl font-bold text-primary-dark mb-6">Account Info</h1>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePictureChange}
      />

      {/* Player Info — prominent card at top */}
      <div className="border border-primary-dark/30 rounded-lg bg-white overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-2 bg-primary-dark/10 border-b border-primary-dark/20">
          <div className="flex items-center gap-2 text-primary-dark font-semibold text-sm">
            <FontAwesomeIcon icon={faUser} />
            <span>Player Info</span>
          </div>
          {!editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1.5 text-xs text-primary-dark border border-primary-dark/40 rounded px-2 py-1 hover:bg-primary-dark hover:text-white transition-colors"
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
                <span className="text-xs text-gray-400 italic">Click to change picture</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Player name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player name..."
                  className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary-dark/40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Nationality</label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary-dark/40 bg-white"
                >
                  <option value="">— Select nationality —</option>
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">GrooveStats API Key</label>
                <input
                  type="text"
                  value={grooveStatsApi}
                  onChange={(e) => setGrooveStatsApi(e.target.value)}
                  placeholder="Enter GrooveStats API key..."
                  className="border rounded px-3 py-1.5 text-sm font-mono w-full focus:outline-none focus:ring-2 focus:ring-primary-dark/40"
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
                  className="text-sm text-gray-500 hover:underline px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <Avatar size="md" />
              <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                <p className="font-bold text-lg text-gray-900 leading-tight">
                  {account.player?.playerName || (
                    <span className="text-gray-400 italic font-normal text-base">No player name set</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {account.nationality || (
                    <button
                      onClick={() => setEditingProfile(true)}
                      className="text-gray-400 italic hover:text-primary-dark hover:underline"
                    >
                      No nationality — click to add
                    </button>
                  )}
                </p>
                <div className="mt-1">
                  <span className="text-xs text-gray-400">GrooveStats API Key: </span>
                  <span className="text-xs font-mono text-gray-600">
                    {account.grooveStatsApi || <span className="italic text-gray-400">Not set</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account details */}
      <div className="bg-gray-50 rounded-lg p-6 flex flex-col gap-3">
        <div>
          <span className="text-sm text-gray-500">Username</span>
          <p className="font-semibold">{account.username}</p>
        </div>
      </div>
    </div>
  );
}
