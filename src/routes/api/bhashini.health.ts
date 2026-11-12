import process from "node:process";
import { createFileRoute } from "@tanstack/react-router";

const CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const CONFIG_TIMEOUT_MS = 20_000;

const HEALTH_TASKS = ["asr", "translation", "tts"] as const;
type HealthTask = (typeof HEALTH_TASKS)[number];

type TaskStatuses = Record<HealthTask, number | null>;
type LanguageLists = {
  asr: string[];
  translation: string[];
  tts: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTaskLanguages(value: unknown, task: HealthTask): string[] {
  if (!isRecord(value) || !Array.isArray(value["pipelineResponseConfig"])) return [];
  const taskConfig = value["pipelineResponseConfig"].find(
    (item) => isRecord(item) && item["taskType"] === task,
  );
  if (!isRecord(taskConfig) || !Array.isArray(taskConfig["config"])) return [];

  const languages = new Set<string>();
  for (const serviceConfig of taskConfig["config"]) {
    if (!isRecord(serviceConfig) || !isRecord(serviceConfig["language"])) continue;
    const sourceLanguage = serviceConfig["language"]["sourceLanguage"];
    const targetLanguage = serviceConfig["language"]["targetLanguage"];
    if (typeof sourceLanguage !== "string") continue;
    languages.add(
      task === "translation" && typeof targetLanguage === "string"
        ? `${sourceLanguage}-${targetLanguage}`
        : sourceLanguage,
    );
  }
  return [...languages].sort();
}

export const Route = createFileRoute("/api/bhashini/health")({
  server: {
    handlers: {
      GET: async () => {
        const userID = process.env["BHASHINI_USER_ID"];
        const ulcaApiKey = process.env["BHASHINI_ULCA_API_KEY"];
        const pipelineId = process.env["BHASHINI_PIPELINE_ID"];
        const credentials = {
          BHASHINI_USER_ID: Boolean(userID),
          BHASHINI_ULCA_API_KEY: Boolean(ulcaApiKey),
          BHASHINI_PIPELINE_ID: Boolean(pipelineId),
        };
        const emptyLanguages: LanguageLists = { asr: [], translation: [], tts: [] };
        const emptyStatuses: TaskStatuses = { asr: null, translation: null, tts: null };

        if (!userID || !ulcaApiKey || !pipelineId) {
          return Response.json({
            credentials,
            pipelineConfig: { statusCode: emptyStatuses, languages: emptyLanguages },
          });
        }

        const statuses = { ...emptyStatuses };
        const languages = { ...emptyLanguages };
        await Promise.all(
          HEALTH_TASKS.map(async (task) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
            try {
              const response = await fetch(CONFIG_URL, {
                method: "POST",
                headers: { "content-type": "application/json", userID, ulcaApiKey },
                body: JSON.stringify({
                  pipelineTasks: [{ taskType: task }],
                  pipelineRequestConfig: { pipelineId },
                }),
                signal: controller.signal,
              });
              statuses[task] = response.status;
              if (response.ok) {
                const config: unknown = await response.json();
                languages[task] = getTaskLanguages(config, task);
              }
            } catch {
              statuses[task] = null;
            } finally {
              clearTimeout(timeout);
            }
          }),
        );
        return Response.json({
          credentials,
          pipelineConfig: { statusCode: statuses, languages },
        });
      },
    },
  },
});
