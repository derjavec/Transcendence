import { t } from "../../i18n.js";
import * as User from "../../routes/user.routes.js";
import { render } from "../../router.js";

export async function settingsView() {
  const app = document.getElementById("app");
  if (!app) return;

  const userId = Number(sessionStorage.getItem("userId"));
  if (!userId) {
    console.error("User ID is not available");
    return;
  }

  const savedSettings = getLocalSettings();

  let currentLang = "en";
  let languageMode = "dynamic";

  try {
    const userSettings = await User.getUserSettings(userId);
    currentLang = userSettings.language || "en";
    languageMode = userSettings.languageMode || "dynamic";
  } catch (error) {
    console.warn("⚠️ Failed to fetch user settings");
  }

  app.innerHTML = getSettingsHTML(currentLang, languageMode);
  fillSettingsForm(savedSettings);

  const form = document.getElementById("combinedSettingsForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form as HTMLFormElement);

    saveLocalSettings(formData);
    const preferences = getLanguagePreferences(formData);

    try {
      await User.saveUserSettings(userId, preferences);
      alert("✅ Settings saved.");
      await render();
    } catch (err) {
      console.error("❌ Error saving language preferences", err);
      alert("❌ " + t("errorSavingLanguageSettings"));
    }
  });
}

function getLocalSettings(): Record<string, string> {
  const stored = sessionStorage.getItem("settings");
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Error parsing settings from sessionStorage:", e);
    return {};
  }
}

function fillSettingsForm(settings: Record<string, string>) {
  const fields = [
    "bgColor", "paddleSize", "paddleColor",
    "ballSize", "ballColor", "ballSpeed", "paddleSpeed"
  ];
  for (const key of fields) {
    const el = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
    if (el && settings[key]) {
      el.value = settings[key];
    }
  }
}

// function saveLocalSettings(formData: FormData) {
//   const localPrefs = {
//     bgColor: formData.get("bgColor"),
//     paddleSize: formData.get("paddleSize"),
//     paddleColor: formData.get("paddleColor"),
//     ballSize: formData.get("ballSize"),
//     ballColor: formData.get("ballColor"),
//     ballSpeed: formData.get("ballSpeed"),
//     paddleSpeed: formData.get("paddleSpeed"),
//   };
//   console.log("✅ Local settings saved.");
// }

function saveLocalSettings(formData: FormData) {
  const translateToEnglish = (value: string) => {
    const map: Record<string, string> = {
      // Tamaños
      [t("small").toLowerCase()]: "small",
      [t("large").toLowerCase()]: "large",

      // Velocidades
      [t("normal").toLowerCase()]: "normal",
      [t("fast").toLowerCase()]: "fast"
    };
    return map[value.toLowerCase()] || value;
  };

  const localPrefs = {
    bgColor: formData.get("bgColor"),
    paddleSize: translateToEnglish(String(formData.get("paddleSize"))),
    paddleColor: formData.get("paddleColor"),
    ballSize: translateToEnglish(String(formData.get("ballSize"))),
    ballColor: formData.get("ballColor"),
    ballSpeed: translateToEnglish(String(formData.get("ballSpeed"))),
    paddleSpeed: translateToEnglish(String(formData.get("paddleSpeed")))
  };

  sessionStorage.setItem("settings", JSON.stringify(localPrefs));
  console.log("✅ Local settings saved in English:", localPrefs);
}


function getLanguagePreferences(formData: FormData) {
  const language = formData.get("languageSetting");
  if (!language || typeof language !== "string") {
    console.error("Invalid language");
    return { language: "en", languageMode: "dynamic" };
  }

  return {
    language,
    languageMode: language === "dynamic" ? "dynamic" : "fixed"
  };
}

export function getSettingsHTML(currentLang: string, languageMode: string): string {
  return `
    <div class="text-center px-4 sm:px-6 md:px-8 max-w-screen-sm mx-auto space-y-6">
      <h1 class="text-xl glow">⚙️ ${t("settingsTitle")}</h1>

      <form id="combinedSettingsForm"
        class="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-x-4 gap-y-3 items-center text-left">

        ${colorField("bgColor", "🎨", t("canvasBg"))}
        ${selectField("paddleSize", "🏓", t("paddleSize"), [t("small"), t("large")])}
        ${colorField("paddleColor", "🏓", t("paddleColor"), "#ffffff")}
        ${selectField("ballSize", "⚪", t("ballSize"), [t("small"), t("large")])}
        ${colorField("ballColor", "⚪", t("ballColor"), "#ffffff")}
        ${selectField("ballSpeed", "🚀", t("ballSpeed"), [t("normal"), t("fast")])}
        ${selectField("paddleSpeed", "🕹️", t("paddleSpeed"), [t("normal"), t("fast")])}

        <label for="languageSetting" class="text-right sm:text-right pr-2">🌍 ${t("language")}:</label>
        <select id="languageSetting" name="languageSetting" class="w-full">
          <option value="dynamic" ${languageMode === "dynamic" ? "selected" : ""}>🌐 ${t("autoDetect")}</option>
          <option value="en" ${currentLang === "en" && languageMode === "fixed" ? "selected" : ""}>🇬🇧 English</option>
          <option value="fr" ${currentLang === "fr" && languageMode === "fixed" ? "selected" : ""}>🇫🇷 Français</option>
          <option value="es" ${currentLang === "es" && languageMode === "fixed" ? "selected" : ""}>🇪🇸 Español</option>
        </select>

        <div></div>
        <button type="submit" class="btn w-full">${t("saveSettings")}</button>
      </form>
    </div>
  `;
}
  
function colorField(id: string, emoji: string, label: string, value: string = "") {
  return `
    <label for="${id}" class="text-right pr-2">${emoji} ${label}:</label>
    <input type="color" id="${id}" name="${id}" value="${value}" />
  `;
}

function selectField(id: string, emoji: string, label: string, options: string[]) {
  return `
    <label for="${id}" class="text-right pr-2">${emoji} ${label}:</label>
    <select id="${id}" name="${id}">
      ${options.map(opt => `<option value="${opt.toLowerCase()}">${opt}</option>`).join("")}
    </select>
  `;
}