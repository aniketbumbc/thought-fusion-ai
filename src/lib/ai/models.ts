import 'server-only';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { config, type ProviderId } from './modelConfig';

export interface CandidateModel {
  provider: ProviderId;
  label: string;
  model: string;
  llm: BaseChatModel;
}

export function makeCandidate(provider: ProviderId): CandidateModel {
  const common = {
    temperature: config.temperature,
    maxRetries: 1,
  };

  switch (provider) {
    case 'openai': {
      const model = config.candidateModels.openai;
      return {
        provider,
        label: `OpenAI · ${model}`,
        model,
        llm: new ChatOpenAI({ ...common, model, apiKey: config.keys.openai }),
      };
    }
    case 'anthropic': {
      const model = config.candidateModels.anthropic;
      return {
        provider,
        label: `Claude · ${model}`,
        model,
        llm: new ChatAnthropic({
          ...common,
          model,
          apiKey: config.keys.anthropic,
        }),
      };
    }
    case 'google': {
      const model = config.candidateModels.google;
      return {
        provider,
        label: `Gemini · ${model}`,
        model,
        llm: new ChatGoogleGenerativeAI({
          ...common,
          model,
          apiKey: config.keys.google,
        }),
      };
    }
  }
}

export function makeSynthesizer(): BaseChatModel {
  return new ChatAnthropic({
    model: config.synthesizerModel,
    apiKey: config.keys.anthropic,
    temperature: 0.2,
    maxRetries: 1,
  });
}
