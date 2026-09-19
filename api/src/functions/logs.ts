import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { tableService } from '../services/tableService';
import { DraftEntry } from '../types/apiTypes';
import * as dotenv from 'dotenv';

dotenv.config();

export async function logPostHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as any;

    if (!body) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const rawInput = body.rawInput || '';

    // Support both single draft item and batch array of entries
    if (Array.isArray(body.entries)) {
      const records = await tableService.insertBatch(body.entries as DraftEntry[], rawInput);
      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, records, count: records.length })
      };
    } else if (body.name && body.type) {
      const record = await tableService.insertEntry(body as DraftEntry, rawInput);
      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, record })
      };
    } else {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid log payload. Must provide "entries" array or single entry object.' })
      };
    }
  } catch (error: any) {
    context.error('Error inserting log:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to save log entry' })
    };
  }
}

export async function logsGetHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const startDate = request.query.get('startDate') || undefined;
    const endDate = request.query.get('endDate') || undefined;

    const logs = await tableService.getLogs(startDate, endDate);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, logs, count: logs.length })
    };
  } catch (error: any) {
    context.error('Error fetching logs:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to retrieve logs' })
    };
  }
}

export async function logDeleteHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const partitionKey = request.query.get('partitionKey') || 'log';
    const rowKey = request.query.get('rowKey');

    if (!rowKey) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'rowKey query parameter is required for deletion' })
      };
    }

    const success = await tableService.deleteLog(partitionKey, rowKey);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success, rowKey })
    };
  } catch (error: any) {
    context.error('Error deleting log:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to delete log entry' })
    };
  }
}

// Register HTTP routes
app.http('log_post', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'log',
  handler: logPostHandler
});

app.http('logs_get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'logs',
  handler: logsGetHandler
});

app.http('logs_delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'logs',
  handler: logDeleteHandler
});

export async function healthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
  };
}

app.http('health_get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler
});

