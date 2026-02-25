/**
 * Comprehensive language catalog grouped by popularity
 * Used by the admin UI to offer a searchable language selector
 * @packageDocumentation
 */

import type { Direction } from './types'

export interface CatalogLanguage {
  code: string
  name: string
  nativeName: string
  direction: Direction
  flagEmoji: string
  group: 'popular' | 'european' | 'asian' | 'middle_eastern' | 'african' | 'other'
}

export const LANGUAGE_GROUP_LABELS: Record<CatalogLanguage['group'], string> = {
  popular: 'Langues populaires',
  european: 'Europe',
  asian: 'Asie & Pacifique',
  middle_eastern: 'Moyen-Orient',
  african: 'Afrique',
  other: 'Autres',
}

/**
 * Full language catalog — ~60 languages covering 95%+ of restaurant clientele worldwide
 * Ordered by global speaker count within each group
 */
export const LANGUAGES_CATALOG: CatalogLanguage[] = [
  // === Popular (top 15 most requested for restaurants) ===
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flagEmoji: '🇫🇷', group: 'popular' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flagEmoji: '🇬🇧', group: 'popular' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flagEmoji: '🇪🇸', group: 'popular' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flagEmoji: '🇩🇪', group: 'popular' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', flagEmoji: '🇮🇹', group: 'popular' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', flagEmoji: '🇵🇹', group: 'popular' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flagEmoji: '🇸🇦', group: 'popular' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', flagEmoji: '🇨🇳', group: 'popular' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', flagEmoji: '🇯🇵', group: 'popular' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', flagEmoji: '🇰🇷', group: 'popular' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', flagEmoji: '🇳🇱', group: 'popular' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', flagEmoji: '🇷🇺', group: 'popular' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', flagEmoji: '🇹🇷', group: 'popular' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr', flagEmoji: '🇵🇱', group: 'popular' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', flagEmoji: '🇮🇳', group: 'popular' },

  // === European ===
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', direction: 'ltr', flagEmoji: '🇺🇦', group: 'european' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', direction: 'ltr', flagEmoji: '🇷🇴', group: 'european' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', direction: 'ltr', flagEmoji: '🇨🇿', group: 'european' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', direction: 'ltr', flagEmoji: '🇬🇷', group: 'european' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', flagEmoji: '🇭🇺', group: 'european' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr', flagEmoji: '🇸🇪', group: 'european' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', direction: 'ltr', flagEmoji: '🇩🇰', group: 'european' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr', flagEmoji: '🇫🇮', group: 'european' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr', flagEmoji: '🇳🇴', group: 'european' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', direction: 'ltr', flagEmoji: '🇸🇰', group: 'european' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', direction: 'ltr', flagEmoji: '🇧🇬', group: 'european' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', direction: 'ltr', flagEmoji: '🇭🇷', group: 'european' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', direction: 'ltr', flagEmoji: '🇷🇸', group: 'european' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', direction: 'ltr', flagEmoji: '🇸🇮', group: 'european' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', direction: 'ltr', flagEmoji: '🇱🇹', group: 'european' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', direction: 'ltr', flagEmoji: '🇱🇻', group: 'european' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', direction: 'ltr', flagEmoji: '🇪🇪', group: 'european' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', direction: 'ltr', flagEmoji: '🏴', group: 'european' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', direction: 'ltr', flagEmoji: '🏴', group: 'european' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', direction: 'ltr', flagEmoji: '🇮🇪', group: 'european' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', direction: 'ltr', flagEmoji: '🇦🇱', group: 'european' },

  // === Asian & Pacific ===
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', direction: 'ltr', flagEmoji: '🇹🇼', group: 'asian' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', flagEmoji: '🇹🇭', group: 'asian' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', flagEmoji: '🇻🇳', group: 'asian' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', flagEmoji: '🇮🇩', group: 'asian' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', flagEmoji: '🇲🇾', group: 'asian' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', direction: 'ltr', flagEmoji: '🇵🇭', group: 'asian' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', flagEmoji: '🇧🇩', group: 'asian' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', direction: 'ltr', flagEmoji: '🇮🇳', group: 'asian' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', direction: 'ltr', flagEmoji: '🇳🇵', group: 'asian' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', direction: 'ltr', flagEmoji: '🇰🇭', group: 'asian' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ', direction: 'ltr', flagEmoji: '🇲🇲', group: 'asian' },

  // === Middle Eastern ===
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl', flagEmoji: '🇮🇱', group: 'middle_eastern' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', direction: 'rtl', flagEmoji: '🇮🇷', group: 'middle_eastern' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl', flagEmoji: '🇵🇰', group: 'middle_eastern' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî', direction: 'ltr', flagEmoji: '🏴', group: 'middle_eastern' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', direction: 'rtl', flagEmoji: '🇦🇫', group: 'middle_eastern' },

  // === African ===
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', flagEmoji: '🇰🇪', group: 'african' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', direction: 'ltr', flagEmoji: '🇪🇹', group: 'african' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', direction: 'ltr', flagEmoji: '🇳🇬', group: 'african' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', direction: 'ltr', flagEmoji: '🇳🇬', group: 'african' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', direction: 'ltr', flagEmoji: '🇿🇦', group: 'african' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', direction: 'ltr', flagEmoji: '🇲🇬', group: 'african' },

  // === Other ===
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', direction: 'ltr', flagEmoji: '🇬🇪', group: 'other' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', direction: 'ltr', flagEmoji: '🇦🇲', group: 'other' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', direction: 'ltr', flagEmoji: '🇦🇿', group: 'other' },
  { code: 'uz', name: 'Uzbek', nativeName: "O'zbek", direction: 'ltr', flagEmoji: '🇺🇿', group: 'other' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ', direction: 'ltr', flagEmoji: '🇰🇿', group: 'other' },
]

/**
 * Find a language from the catalog by its code
 */
export function findCatalogLanguage(code: string): CatalogLanguage | undefined {
  return LANGUAGES_CATALOG.find((lang) => lang.code === code)
}

/**
 * Get languages grouped by their group field
 */
export function getLanguagesByGroup(): Record<CatalogLanguage['group'], CatalogLanguage[]> {
  const groups: Record<CatalogLanguage['group'], CatalogLanguage[]> = {
    popular: [],
    european: [],
    asian: [],
    middle_eastern: [],
    african: [],
    other: [],
  }
  for (const lang of LANGUAGES_CATALOG) {
    groups[lang.group].push(lang)
  }
  return groups
}
