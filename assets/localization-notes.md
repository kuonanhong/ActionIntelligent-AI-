# Portal localization registry

`portal-locales.json` is a lightweight localization registry for the Smart Action portal. It covers 78 major languages used across Asia and Europe; it is not a claim of covering every language or every regional variety.

## Schema

```text
{ locales: [{ code, name, nativeName, dir, strings }] }
```

- `code` uses a BCP 47-style language tag.
- `name` is the English language name; `nativeName` is the self-name shown in the selector.
- `dir` is `rtl` for `ar`, `he`, `fa`, `ur`, `ps`, and `ku`; all other entries are `ltr`.
- `strings` contains translated portal labels. The runtime should merge the selected locale over English so a missing key falls back to English.

## Coverage levels

- 42 locales contain all 35 currently defined portal and shared-video strings: `zh-TW`, `zh-CN`, `en`, `fr`, `ja`, `es`, `ko`, `ar`, `ms`, `th`, `vi`, `id`, `fil`, `de`, `pl`, `cs`, `pt`, `fi`, `sv`, `ru`, `it`, `nl`, `da`, `nb`, `el`, `hu`, `ro`, `sk`, `sl`, `hr`, `sr`, `bg`, `uk`, `be`, `lt`, `lv`, `et`, `tr`, `he`, `fa`, `ur`, and `hi`.
- 36 additional locales contain a native title, short non-clinical introduction, main navigation labels, a native partial-translation notice, and essential controls. Missing detailed labels intentionally fall back to English.
- The complete legacy article archive remains available only in the existing six languages: Traditional Chinese, Simplified Chinese, English, French, Japanese, and Spanish. The registry does not imply that legacy medical articles were translated into all 78 languages.

The 35 full-coverage keys are the 23 portal keys (`homepageTitle`, `intro`, `home`, `brain`, `drone`, `video`, `articles`, `resources`, `support`, `language`, `translationNotice`, `start`, `pause`, `reset`, `help`, `beginner`, `normal`, `expert`, `firstPerson`, `thirdPerson`, `optionalSupport`, `privacy`, `noGate`) plus 12 shared-video keys (`uploadImage`, `uploadVideo`, `prompt`, `model`, `create`, `download`, `cancel`, `duration`, `resolution`, `localOnly`, `backendRequired`, `notGenerative`).

## Editorial and medical review status

The strings are a practical first-pass interface translation. They were not reviewed by native-language editors, clinicians, or medical translators. The introductions deliberately make no diagnosis, treatment, safety, or performance claims: they only describe community learning, movement, and Parkinson resources.

Before treating any language as publication-grade, ask a native speaker to review navigation terms, regional register, accessibility wording, and typography. Any future translation of medical content requires separate clinical and language review. Keep the on-page translation notice visible so visitors understand that the interface/overview may be translated while detailed labels can fall back to English and the full archive is limited to six languages.

## Runtime checks

1. Always load English as the base dictionary, then overlay the selected locale.
2. Apply `document.documentElement.lang` and `document.documentElement.dir` from the selected entry.
3. Persist an explicit visitor choice; otherwise use the browser language as a hint, not a precise location detector.
4. Never auto-translate or relabel clinical statements as professionally reviewed.
5. Test Arabic, Hebrew, Persian, Urdu, Pashto, and Kurdish in a real RTL layout, including mixed Latin brand text and numerals.
