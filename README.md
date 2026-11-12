# Kisan Saathi

Build "KisanSaathi", a mobile-first web app for small Indian farmers with low literacy and cheap phones. The app advises where, when and how to sell a crop to keep the most money. The farmer always decides; the app only advises.

Rules for every screen: big buttons (min 56px), text at least 18px, one question per screen, icons plus text (never colour alone), a Back button and a Help (?) button on every screen, simple friendly words.

Build only these 3 screens now:

1. Language picker: all indian official language shown in native script with big buttons

2. Crop picker: picture cards for tomato, onion, potato, wheat, paddy

3. Quantity screen: big + and − buttons, unit "quintal"

Use React, Tailwind, and a translation file for all text. Show me the result.


### Generate offline translations

The interface uses a local translation bundle so result screens work without a
translation network request. To fill in missing translations with Bhashini,
create a root `.env.local` file with your Bhashini credentials and translation
pipeline ID:

```text
BHASHINI_USER_ID=your-user-id
BHASHINI_ULCA_API_KEY=your-ulca-api-key
BHASHINI_AUTH_TOKEN=your-authorization-token
BHASHINI_PIPELINE_ID=your-pipeline-id
```

Then run:

```sh
npm run i18n:generate
```

The generator sends only fixed English interface strings to Bhashini. It does
not send farmer-entered data or calculate prices. Generated text is bundled in
the app for offline use and should be reviewed by fluent speakers, especially
the wording about money and loans. `.env.local` is ignored by Git; never commit
or share its credentials.

### Generate fixed spoken audio

The app can play pre-generated female-voice audio for fixed prompts before requesting
speech for dynamic text. Add `BHASHINI_USER_ID`, `BHASHINI_ULCA_API_KEY`, and
`BHASHINI_PIPELINE_ID` to `.env.local` (an authorization token is optional), then run:

```sh
npm run tts:generate
```

The script queries Bhashini TTS support, skips unsupported languages, and saves successful
audio plus a hash-checked manifest under `public/audio/tts/`. It updates the manifest after
each line, so rerunning the command resumes by skipping matching files already generated.
It reports any lines still missing after retries. Do not commit credentials; audio and its
manifest are static app assets.

Test manifest matching and the static → cache → Bhashini → browser fallback order with:

```sh
npx vitest run src/services/static-tts.test.ts src/hooks/use-card-speech.test.ts
```
