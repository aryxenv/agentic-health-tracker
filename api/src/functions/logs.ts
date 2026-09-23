import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../services/cosmosService';
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
    const userId = body.userId || body.partitionKey || 'default_user';

    // Support updating an existing log entry
    if (body.rowKey || body.id) {
      const rowKey = body.rowKey || body.id;
      const record = await cosmosService.updateLog(rowKey, body as DraftEntry, userId, body.timestamp);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, record })
      };
    }

    // Support both single draft item and batch array of entries
    if (Array.isArray(body.entries)) {
      const records = await cosmosService.insertBatch(body.entries as DraftEntry[], rawInput, userId);
      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, records, count: records.length })
      };
    } else if (body.name && body.type) {
      const record = await cosmosService.insertEntry(body as DraftEntry, rawInput, userId);
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
    context.error('Error inserting log into Cosmos DB:', error);
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
    const userId = request.query.get('userId') || 'default_user';

    const logs = await cosmosService.getLogs(startDate, endDate, userId);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, logs, count: logs.length })
    };
  } catch (error: any) {
    context.error('Error fetching logs from Cosmos DB:', error);
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
    const partitionKey = request.query.get('partitionKey') || request.query.get('userId') || 'default_user';
    const rowKey = request.query.get('rowKey') || request.query.get('id');

    if (!rowKey) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'rowKey or id query parameter is required for deletion' })
      };
    }

    const success = await cosmosService.deleteLog(rowKey, partitionKey);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success, rowKey })
    };
  } catch (error: any) {
    context.error('Error deleting log from Cosmos DB:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to delete log entry' })
    };
  }
}

export async function profileGetHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userId = request.query.get('userId') || 'default_user';
    const profile = await cosmosService.getProfile(userId);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, profile })
    };
  } catch (error: any) {
    context.error('Error fetching profile from Cosmos DB:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to retrieve profile' })
    };
  }
}

export async function profilePostHandler(
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
    const userId = body.userId || 'default_user';
    const profile = await cosmosService.upsertProfile(body, userId);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, profile })
    };
  } catch (error: any) {
    context.error('Error saving profile to Cosmos DB:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to save profile' })
    };
  }
}

// Register HTTP routes
app.http('log_post', {
  methods: ['POST', 'PUT'],
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

app.http('profile_get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: profileGetHandler
});

app.http('profile_post', {
  methods: ['POST', 'PUT'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: profilePostHandler
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
