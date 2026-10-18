# Translation export fonts

These fonts are served locally for selectable PDF text and rebuilt translation images. The browser does not send document content to an external font service. Font binaries are loaded only when needed for an export.

`sources.json` records pinned upstream revisions and filenames. Original SIL Open Font License notices accompany the fonts. Noto Sans and Noto Sans Arabic are unmodified upstream binaries.

`TranslationCJK-Regular.ttf` is an OFL-licensed derivative of Noto Sans CJK SC Variable TrueType. It was instantiated at `wght=400` with fontTools 4.59.2 and renamed to **New API Translation CJK** (PostScript name `NewAPITranslationCJK-Regular`). Original copyright and license name records remain intact. The static TrueType format supports reliable PDF font subsetting, including Chinese, Japanese and Korean glyphs. The build uses `TTFont(..., recalcTimestamp=False)`, `instantiateVariableFont(font, {"wght": 400}, inplace=True, optimize=True)`, then updates family/style/PostScript name records and sets `font["glyf"].padding = 2` before saving. Two-byte glyph alignment prevents short-location truncation in browser font subsetting. The source URL and resulting SHA-256 are recorded in `sources.json`.

`TranslationSymbols-Regular.ttf` and `TranslationEmoji-Regular.ttf` are also aligned to two-byte glyph boundaries and renamed to **New API Translation Symbols** and **New API Translation Emoji**. The emoji font is instantiated at `wght=400`; both retain their original copyright and OFL licenses.

Do not replace these files with proprietary system fonts. Retain the associated license and provenance files when distributing the application.
