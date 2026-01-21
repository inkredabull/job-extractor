import { BaseAgent } from '../packages/core/src/agents/base-agent';
import { AgentConfig, ExtractorResult } from '../packages/core/src/types';
import OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/chat/completions';

jest.mock('openai');

class TestAgent extends BaseAgent {
  async extract(url: string): Promise<ExtractorResult> {
    return { success: true, data: { title: 'Test', company: 'Test', location: 'Test', description: 'Test' } };
  }

  async testMakeOpenAIRequest(prompt: string): Promise<string> {
    return this.makeOpenAIRequest(prompt);
  }
}

describe('BaseAgent', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let agent: TestAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      openaiApiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 2000,
    };

    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<OpenAI>;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    agent = new TestAgent(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct config', () => {
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
  });

  it('should make successful OpenAI request', async () => {
    const mockResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Test response',
            tool_calls: []
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    } as any;

    (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

    const result = await agent.testMakeOpenAIRequest('Test prompt');

    expect(result).toBe('Test response');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Test prompt',
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
  });

  it('should handle OpenAI API errors', async () => {
    (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockImplementation(() => Promise.reject(new Error('API Error')));

    await expect(agent.testMakeOpenAIRequest('Test prompt')).rejects.toThrow(
      'OpenAI API error: API Error'
    );
  });

  it('should handle empty response', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    };

    (mockOpenAI.chat.completions.create as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

    const result = await agent.testMakeOpenAIRequest('Test prompt');

    expect(result).toBe('');
  });
});