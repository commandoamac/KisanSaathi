import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
const sourceFile = path.join(root, "src", "i18n", "translations.ts");
const outputFile = path.join(root, "src", "i18n", "generated-translations.ts");
const modelEndpoint = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const inferenceEndpoint = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const batchSize = 10;

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(BHASHINI_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    values[match[1]] = value;
  }
  return values;
}

async function getConfig() {
  let fileValues = {};
  try {
    fileValues = parseEnv(await fs.readFile(envFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const config = {
    BHASHINI_USER_ID: process.env.BHASHINI_USER_ID || fileValues.BHASHINI_USER_ID,
    BHASHINI_ULCA_API_KEY: process.env.BHASHINI_ULCA_API_KEY || fileValues.BHASHINI_ULCA_API_KEY,
    BHASHINI_AUTH_TOKEN: process.env.BHASHINI_AUTH_TOKEN || fileValues.BHASHINI_AUTH_TOKEN,
    BHASHINI_PIPELINE_ID: process.env.BHASHINI_PIPELINE_ID || fileValues.BHASHINI_PIPELINE_ID,
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(
      `Missing Bhashini configuration (${missing.join(", ")}). Add the values to .env.local; do not commit that file.`,
    );
  }
  return config;
}

function readTranslationSource(source) {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS });
  const module = { exports: {} };
  new Function("exports", "require", "module", compiled)(module.exports, require, module);
  return module.exports;
}

function headers(config) {
  return {
    Authorization: config.BHASHINI_AUTH_TOKEN,
    userID: config.BHASHINI_USER_ID,
    ulcaApiKey: config.BHASHINI_ULCA_API_KEY,
    "Content-Type": "application/json",
  };
}

async function postJson(url, body, requestHeaders, label) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw new Error(`${label} request failed: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`${label} request failed with HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned an invalid response.`);
  }
}

async function getTranslationConfig(lang, config) {
  const result = await postJson(
    modelEndpoint,
    {
      pipelineTasks: [
        {
          taskType: "translation",
          config: { language: { sourceLanguage: "en", targetLanguage: lang } },
        },
      ],
      pipelineRequestConfig: { pipelineId: config.BHASHINI_PIPELINE_ID },
    },
    headers(config),
    `Bhashini model lookup for ${lang}`,
  );
  const modelConfig = result.pipelineResponseConfig?.[0]?.config?.[0];
  if (!modelConfig) {
    throw new Error(`Bhashini returned no English-to-${lang} translation model.`);
  }
  return { taskType: "translation", config: modelConfig };
}

function protectPlaceholders(text) {
  const placeholders = [];
  const source = text.replace(/\{[^{}]+\}/g, (placeholder) => {
    const token = `KISANPH${placeholders.length}TOKEN`;
    placeholders.push({ token, placeholder });
    return token;
  });
  return { source, placeholders };
}

async function translateBatch(messages, lang, pipeline, config) {
  const protectedMessages = messages.map(([key, text]) => ({
    key,
    ...protectPlaceholders(text),
  }));
  const result = await postJson(
    inferenceEndpoint,
    {
      pipelineTasks: [pipeline],
      inputData: { input: protectedMessages.map(({ source }) => ({ source })) },
    },
    headers(config),
    `Bhashini translation for ${lang}`,
  );
  const outputs = result.pipelineResponse?.[0]?.output;
  if (!Array.isArray(outputs) || outputs.length !== protectedMessages.length) {
    throw new Error(`Bhashini returned incomplete translations for ${lang}.`);
  }

  return protectedMessages.map(({ key, placeholders }, index) => {
    let text = outputs[index]?.target;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`Bhashini returned an empty translation for ${lang}.${key}.`);
    }
    for (const { token, placeholder } of placeholders) {
      if (!text.includes(token)) {
        throw new Error(`Bhashini changed a format placeholder in ${lang}.${key}.`);
      }
      text = text.replaceAll(token, placeholder);
    }
    return [key, text.trim()];
  });
}

async function main() {
  const config = await getConfig();
  const source = readTranslationSource(await fs.readFile(sourceFile, "utf8"));
  const { LANGUAGES, STRINGS } = source;
  const english = STRINGS.en;
  const generated = {};

  for (const { code } of LANGUAGES) {
    if (code === "en") continue;
    const existing = STRINGS[code] ?? {};
    const missing = Object.entries(english).filter(([key]) => !existing[key]);
    if (missing.length === 0) continue;

    console.log(`Generating ${missing.length} strings for ${code}...`);
    const pipeline = await getTranslationConfig(code, config);
    generated[code] = {};
    for (let offset = 0; offset < missing.length; offset += batchSize) {
      const batch = missing.slice(offset, offset + batchSize);
      for (const [key, value] of await translateBatch(batch, code, pipeline, config)) {
        generated[code][key] = value;
      }
    }
  }

  for (const { code } of LANGUAGES) {
    if (code === "en") continue;
    const allKeys = new Set([
      ...Object.keys(STRINGS[code] ?? {}),
      ...Object.keys(generated[code] ?? {}),
    ]);
    const missing = Object.keys(english).filter((key) => !allKeys.has(key));
    if (missing.length) {
      throw new Error(`Translations for ${code} are incomplete: ${missing.join(", ")}.`);
    }
  }

  const contents = `import type { LangCode, StringKey } from "./translations";\n\nexport const GENERATED_TRANSLATIONS: Partial<Record<LangCode, Partial<Record<StringKey, string>>>> = ${JSON.stringify(generated, null, 2)};\n`;
  await fs.writeFile(outputFile, contents, "utf8");
  console.log(`Wrote complete translations to ${path.relative(root, outputFile)}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
