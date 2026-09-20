import type { AgenticStep, ChatResponse, DraftEntry, HealthLogRecord, UserProfile } from '../types/health';

const API_BASE = '/api';

export async function checkServerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${API_BASE}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (_) {
    // If /api/health fails, try /api/logs as a fallback ping
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE}/logs`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch (__) {
      return false;
    }
  }
}

export async function sendChatMessageStream(
  messages: { role: string; content: string }[],
  userProfile?: UserProfile,
  onStep?: (step: AgenticStep) => void,
  onDelta?: (delta: string) => void,
  signal?: AbortSignal
): Promise<ChatResponse & { steps?: AgenticStep[] }> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      messages,
      userProfile,
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') || !response.body) {
    return response.json();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMessage: ChatResponse | null = null;
  const collectedSteps: AgenticStep[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = 'message';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        const rawData = trimmed.slice(5).trim();
        try {
          const parsedData = JSON.parse(rawData);
          if (currentEvent === 'step') {
            collectedSteps.push(parsedData);
            if (onStep) onStep(parsedData);
          } else if (currentEvent === 'delta') {
            if (onDelta && parsedData.delta) onDelta(parsedData.delta);
          } else if (currentEvent === 'message') {
            finalMessage = parsedData;
          } else if (currentEvent === 'error') {
            throw new Error(parsedData.error || 'Stream error from Health Agent');
          }
        } catch (e: any) {
          if (currentEvent === 'error') throw e;
        }
      }
    }
  }

  if (!finalMessage) {
    throw new Error('Health Agent stream closed without a final message.');
  }

  return {
    ...finalMessage,
    steps: collectedSteps
  };
}

export async function sendChatMessage(
  messages: { role: string; content: string }[],
  userProfile?: UserProfile
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      userProfile
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function saveLogEntries(
  entries: DraftEntry[],
  rawInput?: string
): Promise<HealthLogRecord[]> {
  const response = await fetch(`${API_BASE}/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entries,
      rawInput
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to save log: ${errText}`);
  }

  const result = await response.json();
  return result.records || [result.record];
}

export async function fetchLogs(startDate?: string, endDate?: string): Promise<HealthLogRecord[]> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const url = `${API_BASE}/logs${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.logs || [];
}

export async function deleteLogRecord(rowKey: string, partitionKey: string = 'log'): Promise<boolean> {
  const url = `${API_BASE}/logs?partitionKey=${encodeURIComponent(partitionKey)}&rowKey=${encodeURIComponent(rowKey)}`;
  const response = await fetch(url, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Failed to delete record: ${response.statusText}`);
  }

  const data = await response.json();
  return Boolean(data.success);
}
