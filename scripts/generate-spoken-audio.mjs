import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "public", "audio", "tts");
const manifestPath = path.join(outputDirectory, "manifest.json");
const configUrl = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const retryDelays = [1000, 2000, 4000];
const supportedLineTextLimit = 2000;
const conversationLineIds = new Set([
  "questionIntent",
  "questionName",
  "questionAmountNeeded",
  "questionNeededBy",
  "questionOther",
  "conversationQuestionCrop",
  "conversationQuestionQuantity",
  "conversationQuestionPlace",
  "conversationQuestionCashBy",
  "conversationQuestionOwes",
  "conversationQuestionDebt",
]);

class HttpStatusError extends Error {
  constructor(status) {
    super(`HTTP ${status}.`);
    this.status = status;
  }
}

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(BHASHINI_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

async function loadConfig() {
  const fileValues = {};
  for (const fileName of [".env.local", ".env"]) {
    try {
      Object.assign(fileValues, parseEnv(await fs.readFile(path.join(root, fileName), "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const config = {
    BHASHINI_USER_ID: process.env.BHASHINI_USER_ID || fileValues.BHASHINI_USER_ID,
    BHASHINI_ULCA_API_KEY: process.env.BHASHINI_ULCA_API_KEY || fileValues.BHASHINI_ULCA_API_KEY,
    BHASHINI_AUTH_TOKEN: process.env.BHASHINI_AUTH_TOKEN || fileValues.BHASHINI_AUTH_TOKEN,
    BHASHINI_PIPELINE_ID: process.env.BHASHINI_PIPELINE_ID || fileValues.BHASHINI_PIPELINE_ID,
  };
  const missing = Object.entries(config)
    .filter(([name, value]) => name !== "BHASHINI_AUTH_TOKEN" && !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(`Missing Bhashini configuration (${missing.join(", ")}).`);
  }
  return config;
}

async function readTranslations() {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const files = ["translations.ts", "generated-translations.ts"];
  const modules = [];
  for (const fileName of files) {
    let source = await fs.readFile(path.join(root, "src", "i18n", fileName), "utf8");
    source = source.replace(
      /import type \{ LangCode, StringKey \} from "\.\/translations";\s*/g,
      "",
    );
    const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS });
    const module = { exports: {} };
    new Function("exports", "require", "module", compiled)(module.exports, require, module);
    modules.push(module.exports);
  }
  return { ...modules[0], ...modules[1] };
}

function configHeaders(config) {
  return {
    ...(config.BHASHINI_AUTH_TOKEN ? { Authorization: config.BHASHINI_AUTH_TOKEN } : {}),
    userID: config.BHASHINI_USER_ID,
    ulcaApiKey: config.BHASHINI_ULCA_API_KEY,
    "content-type": "application/json",
  };
}

async function postJson(url, body, headers, label) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error(`${label}: network request failed.`);
  }
  if (!response.ok) throw new HttpStatusError(response.status);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: invalid response.`);
  }
}

async function getTtsConfiguration(language, config) {
  const response = await postJson(
    configUrl,
    {
      pipelineTasks: [{ taskType: "tts", config: { language: { sourceLanguage: language } } }],
      pipelineRequestConfig: { pipelineId: config.BHASHINI_PIPELINE_ID },
    },
    configHeaders(config),
    "TTS configuration",
  );
  const task = response.pipelineResponseConfig?.find((item) => item?.taskType === "tts");
  const service = task?.config?.find((item) => item?.language?.sourceLanguage === language);
  const endpoint = response.pipelineInferenceAPIEndPoint;
  if (
    !service?.serviceId ||
    typeof endpoint?.callbackUrl !== "string" ||
    typeof endpoint?.inferenceApiKey?.name !== "string" ||
    typeof endpoint?.inferenceApiKey?.value !== "string"
  ) {
    return null;
  }
  return {
    service,
    callbackUrl: endpoint.callbackUrl,
    keyName: endpoint.inferenceApiKey.name,
    keyValue: endpoint.inferenceApiKey.value,
  };
}

async function synthesizeLine(text, ttsConfig) {
  const response = await postJson(
    ttsConfig.callbackUrl,
    {
      pipelineTasks: [
        {
          taskType: "tts",
          config: { ...ttsConfig.service, gender: "female" },
        },
      ],
      inputData: {
        input: [{ source: text }],
        audio: [{ audioContent: null }],
      },
    },
    { "content-type": "application/json", [ttsConfig.keyName]: ttsConfig.keyValue },
    "TTS synthesis",
  );
  const item = response.pipelineResponse?.find((result) => result?.taskType === "tts");
  const audioContent = item?.audio?.[0]?.audioContent;
  if (typeof audioContent !== "string" || !audioContent) {
    throw new Error("TTS synthesis returned no audio.");
  }
  const formatValue = item.config?.audioFormat;
  const format =
    typeof formatValue === "string"
      ? formatValue.toLowerCase()
      : typeof formatValue?.type === "string"
        ? formatValue.type.toLowerCase()
        : "wav";
  const extension = { mp3: "mp3", flac: "flac", ogg: "ogg", webm: "webm" }[format] ?? "wav";
  return { audio: Buffer.from(audioContent, "base64"), extension };
}

async function readManifest() {
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.version === 1 && manifest.voice === "female" && Array.isArray(manifest.entries)) {
      return manifest;
    }
    throw new Error("Existing spoken audio manifest has an unsupported format.");
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, voice: "female", entries: [] };
    throw error;
  }
}

async function saveManifest(manifest) {
  const temporaryPath = `${manifestPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, manifestPath);
}

function getText(translations, language, lineId, key) {
  if (lineId === "languageChoicePrompt" || conversationLineIds.has(lineId)) {
    return (
      translations.STRINGS[language]?.[key] ??
      translations.GENERATED_TRANSLATIONS[language]?.[key] ??
      (language === "en" ? translations.STRINGS.en[key] : undefined)
    );
  }
  return (
    translations.STRINGS[language]?.[key] ??
    translations.GENERATED_TRANSLATIONS[language]?.[key] ??
    translations.STRINGS.en[key]
  );
}

async function main() {
  const config = await loadConfig();
  const translations = await readTranslations();
  const manifest = await readManifest();
  await fs.mkdir(outputDirectory, { recursive: true });

  const supported = [];
  const skipped = [];
  const missing = [];
  for (const language of translations.LANGUAGES) {
    try {
      const ttsConfig = await getTtsConfiguration(language.code, config);
      if (!ttsConfig) {
        skipped.push(language.code);
        console.log(`Skipped language ${language.code}: TTS is not supported.`);
        continue;
      }
      supported.push({ language, ttsConfig });
    } catch (error) {
      if (error instanceof HttpStatusError && [400, 404].includes(error.status)) {
        skipped.push(language.code);
        console.log(`Skipped language ${language.code}: TTS is not supported.`);
      } else {
        console.log(`Language ${language.code}: TTS configuration is unavailable.`);
        for (const lineId of Object.keys(translations.SPOKEN_LINES)) {
          missing.push(`${language.code}.${lineId}`);
        }
      }
    }
  }

  for (const { language, ttsConfig } of supported) {
    for (const [lineId, key] of Object.entries(translations.SPOKEN_LINES)) {
      const text = getText(translations, language.code, lineId, key);
      if (typeof text !== "string" || !text.trim() || text.length > supportedLineTextLimit) {
        if (lineId === "languageChoicePrompt" && typeof text !== "string") continue;
        missing.push(`${language.code}.${lineId}`);
        continue;
      }
      const textHash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
      const existing = manifest.entries.find(
        (entry) =>
          entry.language === language.code &&
          entry.lineId === lineId &&
          entry.textHash === textHash,
      );
      const existingPath =
        typeof existing?.fileName === "string" && existing.fileName.startsWith("/audio/tts/")
          ? path.resolve(root, "public", existing.fileName.slice(1))
          : null;
      if (
        existingPath &&
        existingPath.startsWith(`${outputDirectory}${path.sep}`) &&
        (await fileExists(existingPath))
      ) {
        console.log(`Already generated ${language.code}.${lineId}.`);
        continue;
      }

      const languageDirectory = path.join(outputDirectory, language.code);
      const prefix = `${lineId}-${textHash}`;
      await fs.mkdir(languageDirectory, { recursive: true });
      const existingNames = await fs.readdir(languageDirectory);
      const existingName = existingNames.find((name) => name.startsWith(`${prefix}.`));
      let fileName = existingName;
      if (!fileName) {
        let generated;
        for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
          try {
            generated = await synthesizeLine(text, ttsConfig);
            break;
          } catch {
            if (attempt === retryDelays.length) break;
            await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
          }
        }
        if (!generated) {
          missing.push(`${language.code}.${lineId}`);
          console.log(`Failed ${language.code}.${lineId} after retries.`);
          continue;
        }
        fileName = `${prefix}.${generated.extension}`;
        await fs.writeFile(path.join(languageDirectory, fileName), generated.audio);
      }

      const relativeFileName = path
        .relative(path.join(root, "public"), path.join(languageDirectory, fileName))
        .split(path.sep)
        .join("/");
      manifest.entries = manifest.entries.filter(
        (entry) => !(entry.language === language.code && entry.lineId === lineId),
      );
      manifest.entries.push({
        language: language.code,
        lineId,
        fileName: `/${relativeFileName}`,
        textHash,
      });
      await saveManifest(manifest);
      console.log(`Generated ${language.code}.${lineId}.`);
    }
  }

  if (skipped.length) console.log(`Skipped languages: ${skipped.join(", ")}.`);
  if (missing.length) {
    console.log("Lines still missing:");
    for (const line of missing) console.log(`- ${line}`);
    process.exitCode = 1;
    return;
  }
  console.log("All fixed spoken lines are available for supported languages.");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

const argumentsList = process.argv.slice(2);
if (argumentsList.includes("--help")) {
  console.log("Usage: npm run tts:generate");
  console.log("Resumes female-voice audio generation from public/audio/tts/manifest.json.");
} else if (argumentsList.length > 0) {
  console.error("Unknown option. Use --help for usage.");
  process.exitCode = 1;
} else {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Spoken audio generation failed.");
    process.exitCode = 1;
  });
}
