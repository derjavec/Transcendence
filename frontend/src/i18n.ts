//i18n.ts
type Translations = Record<string, string>;

// Mise en place d'un cache pour les traductions déjà chargées
const translationCache: Record<string, Translations> = {};
// Cache pour les résultats de traduction
const keyResolutionCache: Record<string, string> = {};

let currentLang = 'en';
let dictionary: Translations = {};
let translationsLoaded = false; // Indicateur de chargement des traductions

export async function loadTranslations(lang: string = 'en') {
    currentLang = lang;
    translationsLoaded = false; // Réinitialiser l'indicateur de chargement
    
    // Vérifier si les traductions sont déjà dans le cache
    if (translationCache[lang]) {
        dictionary = translationCache[lang];
        translationsLoaded = true;
        window.dispatchEvent(new CustomEvent("translationsLoaded"));
        return translationsLoaded;
    }

    try{
        const res = await fetch(`/locales/${lang}.json`);
        dictionary = await res.json();

        // Mettre la traduction en cache
        translationCache[lang] = dictionary;

        translationsLoaded = true; // Indiquer que les traductions sont chargées
        window.dispatchEvent(new CustomEvent("translationsLoaded"));

    } catch(err){
        console.error(`Erreur lors du chargement des traductions pour ${lang}:`, err);
        dictionary = {};
    }
    return translationsLoaded;
}

export function isTranslationsLoaded(): boolean {
    return translationsLoaded;
}

export function t(key: string): string {
    // Vérifier si la clé est déjà en cache
    const cacheKey = `${currentLang}.${key}`;
    if (keyResolutionCache[cacheKey]) {
        return keyResolutionCache[cacheKey];
    }

    if (!translationsLoaded) {
        console.warn(`Translations not loaded yet for language: ${currentLang}`);
        return key; // Retourner la clé si les traductions ne sont pas chargées
    }
    
    let result: string;

    // Si la clé ne contient pas de point, essayer d'abord la recherche directe
    if (!key.includes('.')) {
        result = dictionary[key] && typeof dictionary[key] === 'string' 
            ? dictionary[key]
            : key; // Retourner la clé si elle n'est pas trouvée
    } else {
        // Pour les clés avec des points, essayer d'abord la clé plate complète
        if (dictionary[key] && typeof dictionary[key] === 'string') {
            result = dictionary[key];
        } else {
            // Ensuite essayer la navigation imbriquée
            const keys = key.split('.');
            let value: any = dictionary;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    value = key;
                    break;
                }
            }
            
            result = typeof value === 'string' ? value : key;
        }
    }
    
    // Mettre en cache le résultat
    keyResolutionCache[cacheKey] = result;
    return result;
}

export async function changeLanguage(lang: string) {
    // Vider le cache de résolution des clés
    Object.keys(keyResolutionCache).forEach(k => {
        if (k.startsWith(`${currentLang}:`)) {
            delete keyResolutionCache[k];
        }
    });
    // Charger les traductions pour la nouvelle langue
    await loadTranslations(lang);
    currentLang = lang;
}

export async function updateNavBarText(){
    if (!isTranslationsLoaded()) {
        await loadTranslations(currentLang);
    }

    const items = [
        {id: "nav-home", key: "navHome" },
        {id: "nav-solo", key: "navSolo" },
        {id: "nav-1to1", key: "navOnetoOne" },
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

// Précharger les traductions au démarrage de l'application
export async function preloadTranslations(languages: string[] = ['en', 'fr', 'es']) {
    const promises = languages.map(lang => fetch(`/locales/${lang}.json`)
        .then(res => res.json())
        .then(data => {
            translationCache[lang] = data;
            return lang;
        })
        .catch(err => {
            console.error(`Failed to preload translations for ${lang}`, err);
            return null;
        })
    );
    
    await Promise.all(promises);
    
    // Charger la langue actuelle
    if (!translationsLoaded && translationCache[currentLang]) {
        dictionary = translationCache[currentLang];
        translationsLoaded = true;
        window.dispatchEvent(new CustomEvent("translationsLoaded"));
    }
}
