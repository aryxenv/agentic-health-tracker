import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  runHealthAgentStream,
  AVAILABLE_MODEL_CHAIN,
  getNextModelId,
  isRateLimitError
} from '../services/mafHealthAgent';
import { processChatConversation } from '../services/groqService';
import { AgenticStep, ChatMessage, UserProfile } from '../types/apiTypes';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();
if (!process.env.GROQ_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}


// Enable HTTP Streaming support in Azure Functions Node.js v4 runtime
app.setup({ enableHttpStream: true });

export async function chatHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Processing Health Agent chat request: ${request.method} ${request.url}`);

  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      userProfile?: UserProfile;
      stream?: boolean;
      model?: string;
    };

    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid request: "messages" array is required.' })
      };
    }

    const acceptHeader = request.headers.get('accept') || '';
    const wantsStream =
      body.stream === true ||
      request.query.get('stream') === 'true' ||
      acceptHeader.includes('text/event-stream');

    if (wantsStream) {
      // SSE Streaming path for live agentic thought and tool progress
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendEvent = (event: string, data: any) => {
            try {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
              );
            } catch (err) {
              context.error('Error enqueuing SSE chunk:', err);
            }
          };

          const attemptedModels = new Set<string>();
          let currentModel = body.model || process.env.GROQ_MODEL || AVAILABLE_MODEL_CHAIN[0];

          while (true) {
            attemptedModels.add(currentModel);
            try {
              const response = await runHealthAgentStream(
                body.messages!,
                body.userProfile,
                (step) => {
                  sendEvent('step', step);
                },
                (delta) => {
                  sendEvent('delta', { delta });
                },
                currentModel
              );

              sendEvent('message', { ...response, activeModel: currentModel });
              sendEvent('done', {});
              break;
            } catch (agentError: any) {
              const isLimit = isRateLimitError(agentError);
              const nextModel = getNextModelId(currentModel);

              if (isLimit && !attemptedModels.has(nextModel)) {
                context.warn(`Rate limit reached on ${currentModel}. Auto-switching to ${nextModel}...`);
                // Clear any partial streaming text from the failed model
                sendEvent('delta_reset', {});
                sendEvent('step', {
                  id: `step_switch_${Date.now()}`,
                  type: 'thought',
                  title: `Rate limit reached on ${currentModel}. Auto-switching to ${nextModel}...`,
                  thought: `Provider capacity limit reached. Resuming agent deliberation on ${nextModel} with full conversation context.`,
                  timestamp: new Date().toISOString()
                });
                currentModel = nextModel;
                continue;
              }

              context.warn('MAF Health Agent deliberation warning, evaluating fallback:', agentError);
              try {
                // Graceful fallback to groqService if MAF encountered an unexpected runtime issue
                const fallbackResponse = await processChatConversation(
                  body.messages!,
                  body.userProfile,
                  currentModel
                );
                sendEvent('message', { ...fallbackResponse, activeModel: currentModel });
                sendEvent('done', {});
                break;
              } catch (fallbackError: any) {
                sendEvent('error', {
                  error: agentError.message || fallbackError.message || 'Internal agent processing error.',
                  failedModel: currentModel
                });
                break;
              }
            }
          }

          try {
            controller.close();
          } catch (_) {}
        }
      });

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        },
        body: stream
      };
    }

    // Non-streaming JSON path for backward compatibility
    const attemptedModels = new Set<string>();
    let currentModel = body.model || process.env.GROQ_MODEL || AVAILABLE_MODEL_CHAIN[0];

    while (true) {
      attemptedModels.add(currentModel);
      try {
        const steps: AgenticStep[] = [];
        const response = await runHealthAgentStream(
          body.messages,
          body.userProfile,
          (step) => steps.push(step),
          undefined,
          currentModel
        );

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...response, steps, activeModel: currentModel })
        };
      } catch (agentErr: any) {
        const isLimit = isRateLimitError(agentErr);
        const nextModel = getNextModelId(currentModel);

        if (isLimit && !attemptedModels.has(nextModel)) {
          context.warn(`Rate limit reached on ${currentModel}. Auto-switching to ${nextModel}...`);
          currentModel = nextModel;
          continue;
        }

        context.warn('MAF Health Agent encountered error, falling back to groqService:', agentErr);
        try {
          const fallbackResponse = await processChatConversation(body.messages, body.userProfile, currentModel);
          return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...fallbackResponse, activeModel: currentModel })
          };
        } catch (fallbackErr: any) {
          return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: agentErr.message || fallbackErr.message || 'Internal agent processing error.'
            })
          };
        }
      }
    }
  } catch (error: any) {
    context.error('Health Agent chat endpoint error:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Internal server error while processing chat with Health Agent.'
      })
    };
  }
}

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: chatHandler
});
