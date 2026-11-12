import process from "node:process";
import { createFileRoute } from "@tanstack/react-router";

const CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_AUDIO_BASE64_LENGTH = 8 * 1024 * 1024;
const TTS_RETRY_DELAY_MS = 300;
const TTS_FAILURE_LIMIT = 2;
const TTS_CIRCUIT_BREAKER_MS = 2 * 60 * 1000;
const LANG_CODE = /^[a-z]{2,3}$/;

type BhashiniTask = "asr" | "translation" | "tts";
let consecutiveTtsFailures = 0;
let ttsCircuitOpenUntil = 0;
type LanguageConfig = {
  sourceLanguage: string;
  targetLanguage?: string;
};

type RequestPayload = {
  task: BhashiniTask;
  lang?: string;
  from?: string;
  to?: string;
  text?: string;
  audioBase64?: string;
  audioFormat?: string;
  samplingRate?: number;
};

type ServiceConfig = {
  serviceId: string;
  name: string;
};

class BhashiniRequestError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function parseRequest(value: unknown): RequestPayload | null {
  if (!isRecord(value)) return null;
  const task = value["task"];
  if (task !== "asr" && task !== "translation" && task !== "tts") return null;

  const payload: RequestPayload = { task };
  for (const key of ["lang", "from", "to", "text", "audioBase64", "audioFormat"] as const) {
    const field = value[key];
    if (field !== undefined) {
      if (typeof field !== "string") return null;
      payload[key] = field;
    }
  }
  if (value["samplingRate"] !== undefined) {
    if (typeof value["samplingRate"] !== "number" || !Number.isInteger(value["samplingRate"]))
      return null;
    payload.samplingRate = value["samplingRate"];
  }

  if (task === "asr") {
    if (
      !payload.lang ||
      !LANG_CODE.test(payload.lang) ||
      !payload.audioBase64 ||
      payload.audioBase64.length > MAX_AUDIO_BASE64_LENGTH
    )
      return null;
  } else if (task === "translation") {
    if (
      !payload.from ||
      !payload.to ||
      !LANG_CODE.test(payload.from) ||
      !LANG_CODE.test(payload.to) ||
      !payload.text?.trim() ||
      payload.text.length > 10_000
    )
      return null;
  } else if (
    !payload.lang ||
    !LANG_CODE.test(payload.lang) ||
    !payload.text?.trim() ||
    payload.text.length > 10_000
  ) {
    return null;
  }

  if (
    payload.audioFormat !== undefined &&
    !["wav", "mp3", "flac", "webm"].includes(payload.audioFormat.toLowerCase())
  )
    return null;
  if (payload.samplingRate !== undefined && payload.samplingRate < 8000) return null;
  return payload;
}

function getLanguageConfig(payload: RequestPayload): LanguageConfig {
  if (payload.task === "translation") {
    return { sourceLanguage: payload.from!, targetLanguage: payload.to! };
  }
  return { sourceLanguage: payload.lang! };
}

function getTaskConfigRequest(payload: RequestPayload, language: LanguageConfig) {
  const taskConfig: Record<string, unknown> = {
    taskType: payload.task,
    config: { language },
  };
  return {
    pipelineTasks: [taskConfig],
    pipelineRequestConfig: { pipelineId: process.env["BHASHINI_PIPELINE_ID"] },
  };
}

function getServiceConfigs(
  configResponse: unknown,
  task: BhashiniTask,
  language: LanguageConfig,
): ServiceConfig[] {
  if (!isRecord(configResponse) || !Array.isArray(configResponse["pipelineResponseConfig"]))
    return [];
  const taskConfig = configResponse["pipelineResponseConfig"].find(
    (item) => isRecord(item) && item["taskType"] === task,
  );
  if (!isRecord(taskConfig) || !Array.isArray(taskConfig["config"])) return [];

  return taskConfig["config"].flatMap((service): ServiceConfig[] => {
    if (
      !isRecord(service) ||
      typeof service["serviceId"] !== "string" ||
      !isRecord(service["language"]) ||
      service["language"]["sourceLanguage"] !== language.sourceLanguage ||
      (language.targetLanguage !== undefined &&
        service["language"]["targetLanguage"] !== language.targetLanguage)
    ) {
      return [];
    }

    const nameFields = ["serviceName", "modelName", "providerName", "name"] as const;
    const name = nameFields
      .map((field) => service[field])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return [
      { serviceId: service["serviceId"], name: name?.trim().slice(0, 100) ?? "Unnamed service" },
    ];
  });
}

function getInferenceEndpoint(configResponse: unknown) {
  if (!isRecord(configResponse) || !isRecord(configResponse["pipelineInferenceAPIEndPoint"])) {
    return null;
  }
  const endpoint = configResponse["pipelineInferenceAPIEndPoint"];
  const key = endpoint["inferenceApiKey"];
  if (
    typeof endpoint["callbackUrl"] !== "string" ||
    !isRecord(key) ||
    typeof key["name"] !== "string" ||
    typeof key["value"] !== "string" ||
    !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key["name"]) ||
    !key["value"]
  ) {
    return null;
  }
  return {
    callbackUrl: endpoint["callbackUrl"],
    keyName: key["name"],
    keyValue: key["value"],
  };
}

function getSupportedLanguages(configResponse: unknown): unknown[] {
  if (!isRecord(configResponse) || !Array.isArray(configResponse["languages"])) return [];
  return configResponse["languages"].filter(
    (item) =>
      isRecord(item) &&
      typeof item["sourceLanguage"] === "string" &&
      Array.isArray(item["targetLanguageList"]) &&
      item["targetLanguageList"].every((language) => typeof language === "string"),
  );
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new BhashiniRequestError(`HTTP status ${response.status}`, "Bhashini request failed");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof BhashiniRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BhashiniRequestError("timeout", "Bhashini request timed out");
    }
    throw new BhashiniRequestError("network error", "Bhashini request failed");
  } finally {
    clearTimeout(timeout);
  }
}

function logProvider(task: BhashiniTask, provider: string, reason?: string) {
  console.info("[voice-provider]", {
    task: task === "asr" ? "ASR" : task === "tts" ? "TTS" : "Translation",
    provider,
    ...(reason ? { reason } : {}),
  });
}

function recordTtsFailure() {
  consecutiveTtsFailures += 1;
  if (consecutiveTtsFailures >= TTS_FAILURE_LIMIT) {
    ttsCircuitOpenUntil = Date.now() + TTS_CIRCUIT_BREAKER_MS;
    console.info("[voice-provider]", {
      task: "TTS",
      provider: "Browser fallback",
      reason: "circuit breaker open for 2 minutes",
    });
  }
}

function recordTtsSuccess() {
  consecutiveTtsFailures = 0;
  ttsCircuitOpenUntil = 0;
}

function getInferencePayload(payload: RequestPayload, serviceId: string) {
  const language = getLanguageConfig(payload);
  const config: Record<string, unknown> = { language, serviceId };
  if (payload.task === "tts") {
    const configuredGender = process.env["BHASHINI_TTS_GENDER"]?.toLowerCase();
    config["gender"] = configuredGender === "male" ? "male" : "female";
  }
  const inputData: Record<string, unknown> = {
    input: [{ source: payload.task === "asr" ? null : payload.text }],
  };

  if (payload.task === "asr") {
    config["audioFormat"] = payload.audioFormat ?? "wav";
    config["samplingRate"] = payload.samplingRate ?? 16000;
    inputData["audio"] = [{ audioContent: payload.audioBase64 }];
  } else {
    inputData["audio"] = [{ audioContent: null }];
  }

  return { pipelineTasks: [{ taskType: payload.task, config }], inputData };
}

export const Route = createFileRoute("/api/bhashini")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let requestBody: unknown;
        try {
          requestBody = await request.json();
        } catch {
          return jsonResponse({ error: "Request body must be valid JSON." }, 400);
        }
        const payload = parseRequest(requestBody);
        if (!payload) return jsonResponse({ error: "Invalid Bhashini request." }, 400);
        if (payload.task === "tts" && Date.now() < ttsCircuitOpenUntil) {
          logProvider(payload.task, "Browser fallback", "circuit breaker open");
          return jsonResponse(
            { error: "Bhashini TTS is temporarily unavailable.", reason: "circuit breaker open" },
            503,
          );
        }

        const {
          BHASHINI_USER_ID: userID,
          BHASHINI_ULCA_API_KEY: ulcaApiKey,
          BHASHINI_PIPELINE_ID: pipelineId,
        } = process.env;
        if (!userID || !ulcaApiKey || !pipelineId) {
          logProvider(payload.task, "No provider", "missing env var");
          return jsonResponse({ error: "Bhashini server credentials are not configured." }, 503);
        }

        try {
          const configResponse = await fetchJson(CONFIG_URL, {
            method: "POST",
            headers: { "content-type": "application/json", userID, ulcaApiKey },
            body: JSON.stringify(getTaskConfigRequest(payload, getLanguageConfig(payload))),
          });
          const serviceConfigs = getServiceConfigs(
            configResponse,
            payload.task,
            getLanguageConfig(payload),
          );
          const endpoint = getInferenceEndpoint(configResponse);
          if (serviceConfigs.length === 0 || !endpoint) {
            logProvider(payload.task, "No provider", "incomplete pipeline configuration");
            return jsonResponse(
              { error: "Bhashini returned an incomplete pipeline configuration." },
              502,
            );
          }

          let inferenceResponse: unknown = null;
          const servicesToTry =
            payload.task === "tts" ? serviceConfigs : serviceConfigs.slice(0, 1);
          for (const [index, serviceConfig] of servicesToTry.entries()) {
            const retryCount = payload.task === "tts" ? 2 : 1;
            for (let attempt = 0; attempt < retryCount; attempt += 1) {
              try {
                const candidateResponse = await fetchJson(endpoint.callbackUrl, {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    [endpoint.keyName]: endpoint.keyValue,
                  },
                  body: JSON.stringify(getInferencePayload(payload, serviceConfig.serviceId)),
                });
                if (
                  !isRecord(candidateResponse) ||
                  !Array.isArray(candidateResponse["pipelineResponse"])
                ) {
                  throw new BhashiniRequestError(
                    "invalid inference response",
                    "Bhashini returned an invalid inference response",
                  );
                }
                inferenceResponse = candidateResponse;
                break;
              } catch (error) {
                if (payload.task !== "tts" || attempt === retryCount - 1) {
                  if (index === servicesToTry.length - 1) throw error;
                  console.info("[voice-provider]", {
                    task: "TTS",
                    provider: "Bhashini",
                    reason: `service failed; trying ${servicesToTry[index + 1]?.name ?? "next service"}`,
                  });
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, TTS_RETRY_DELAY_MS));
              }
            }
            if (inferenceResponse) break;
          }

          if (payload.task === "tts") recordTtsSuccess();
          logProvider(payload.task, "Bhashini");
          return jsonResponse({
            task: payload.task,
            result: isRecord(inferenceResponse) ? inferenceResponse["pipelineResponse"] : null,
            languages: getSupportedLanguages(configResponse),
          });
        } catch (error) {
          if (payload.task === "tts") recordTtsFailure();
          logProvider(
            payload.task,
            "No provider",
            error instanceof BhashiniRequestError ? error.reason : "request failed",
          );
          return jsonResponse({ error: "Bhashini is unavailable or the request timed out." }, 502);
        }
      },
    },
  },
});
