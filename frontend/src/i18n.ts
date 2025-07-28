//i18n.ts
type Translations = Record<string, string>;

let currentLang = 'en';
let dictionary: Translations = {};
let translationsLoaded = false; // Indicateur de chargement des traductions

export async function loadTranslations(lang: string = 'en') {
    currentLang = lang;
    translationsLoaded = false; // Réinitialiser l'indicateur de chargement
    
    try{
        const res = await fetch(`/locales/${lang}.json`);
        dictionary = await res.json();
        translationsLoaded = true; // Indiquer que les traductions sont chargées
        window.dispatchEvent(new CustomEvent("translationsLoaded"));

    }catch(err){
        console.error(`Erreur lors du chargement des traductions pour ${lang}:`, err);
        dictionary = {};
    }
    return translationsLoaded;
}

export function isTranslationsLoaded(): boolean {
    return translationsLoaded;
}

export function t(key: string): string {
    if (!translationsLoaded) {
        console.warn(`Translations not loaded yet for language: ${currentLang}`);
    }
    return dictionary[key] || key;
}

export async function changeLanguage(lang: string) {
    await loadTranslations(lang);
    currentLang = lang;
}

export async function updateNavBarText(){
    if (!isTranslationsLoaded) {
        await loadTranslations(currentLang);
    }

    const items = [
        {id: "nav-home", key: "navHome" },
        {id: "nav-solo", key: "navSolo" },
        {id: "nav-tournament", key: "navTournament" },
        {id: "nav-profile", key: "navProfile" },
        {id: "nav-settings", key: "navSettings" }
    ];

    for(const item of items){
        const el = document.getElementById(item.id);
        if(el)
            el.textContent = t(item.key);
    }
}