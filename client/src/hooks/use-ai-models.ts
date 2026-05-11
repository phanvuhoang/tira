import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface AiModelOption {
  id: string;
  label: string;
  enabled: boolean;
}

export interface AiModelsResponse {
  default: string;
  models: AiModelOption[];
}

// Fallback nếu API chưa sẵn (để UI không vỡ khi backend cũ).
const FALLBACK: AiModelsResponse = {
  default: "deepseek",
  models: [
    { id: "deepseek", label: "DeepSeek", enabled: true },
    { id: "anthropic", label: "Anthropic (Claude)", enabled: true },
    { id: "openai", label: "OpenAI (ChatGPT)", enabled: true },
    { id: "openrouter1", label: "OpenRouter — model 1", enabled: true },
    { id: "openrouter2", label: "OpenRouter — model 2", enabled: true },
    { id: "openrouter3", label: "OpenRouter — model 3", enabled: true },
    { id: "openrouter4", label: "OpenRouter — model 4", enabled: true },
  ],
};

export function useAiModels(): AiModelsResponse {
  const [data, setData] = useState<AiModelsResponse>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/ai-models");
        const json = (await res.json()) as AiModelsResponse;
        if (!cancelled && json?.models?.length) {
          setData(json);
        }
      } catch {
        // giữ FALLBACK
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
