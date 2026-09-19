import { TableClient, TableEntity } from '@azure/data-tables';
import { DraftEntry, HealthLogRecord } from '../types/apiTypes';

const TABLE_NAME = 'HealthLogs';
const PARTITION_KEY = 'log';

// In-memory fallback for offline/local development without Azure Table Storage configured
const localMemoryStore: Map<string, HealthLogRecord> = new Map();

function generateRowKey(date: Date = new Date()): string {
  const iso = date.toISOString();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${iso}_${randomSuffix}`;
}

export class HealthTableService {
  private client: TableClient | null = null;
  private isInitialized = false;

  constructor() {
    const connString =
      process.env.AZURE_TABLES_CONNECTION_STRING ||
      process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (connString) {
      try {
        this.client = TableClient.fromConnectionString(connString, TABLE_NAME);
      } catch (err) {
        console.warn('Failed to initialize TableClient with connection string, using local store:', err);
      }
    } else {
      console.log('No AZURE_TABLES_CONNECTION_STRING found in environment. Utilizing in-memory development store.');
    }
  }

  private async ensureTable(): Promise<void> {
    if (!this.client || this.isInitialized) return;
    try {
      await this.client.createTable();
      this.isInitialized = true;
    } catch (err: any) {
      // 409 Conflict means table already exists
      if (err.statusCode === 409) {
        this.isInitialized = true;
      } else {
        console.warn('Could not auto-create TableStorage, falling back:', err.message);
      }
    }
  }

  async insertEntry(entry: DraftEntry, rawInput: string = ''): Promise<HealthLogRecord> {
    await this.ensureTable();

    const timestamp = new Date().toISOString();
    const rowKey = generateRowKey();

    const record: HealthLogRecord = {
      partitionKey: PARTITION_KEY,
      rowKey,
      timestamp,
      rawInput,
      ...entry
    };

    if (this.client) {
      try {
        const entity: TableEntity = {
          partitionKey: record.partitionKey,
          rowKey: record.rowKey,
          type: record.type,
          name: record.name,
          calories: record.calories,
          protein: record.protein,
          carbs: record.carbs,
          fat: record.fat,
          fiber: record.fiber,
          sugar: record.sugar,
          sodiumMg: record.sodiumMg,
          mealType: record.mealType,
          durationMin: record.durationMin,
          metValue: record.metValue,
          activeCalories: record.activeCalories,
          modality: record.modality,
          intensity: record.intensity,
          servingInfo: record.servingInfo,
          details: record.details,
          rawInput: record.rawInput,
          timestamp: record.timestamp
        };
        await this.client.createEntity(entity);
      } catch (err: any) {
        console.error('Error writing to Azure Table Storage, saving to memory fallback:', err.message);
        localMemoryStore.set(rowKey, record);
      }
    } else {
      localMemoryStore.set(rowKey, record);
    }

    return record;
  }

  async insertBatch(entries: DraftEntry[], rawInput: string = ''): Promise<HealthLogRecord[]> {
    const records: HealthLogRecord[] = [];
    for (const entry of entries) {
      const rec = await this.insertEntry(entry, rawInput);
      records.push(rec);
    }
    return records;
  }

  async getLogs(startDateStr?: string, endDateStr?: string): Promise<HealthLogRecord[]> {
    await this.ensureTable();

    // Normalize start date to YYYY-MM-DDT00:00:00.000Z and end date to YYYY-MM-DDT23:59:59.999Z
    let startIso = '1970-01-01T00:00:00.000Z';
    let endIso = '2999-12-31T23:59:59.999Z';

    if (startDateStr) {
      const s = new Date(startDateStr);
      if (!isNaN(s.getTime())) {
        s.setUTCHours(0, 0, 0, 0);
        startIso = s.toISOString();
      }
    }

    if (endDateStr) {
      const e = new Date(endDateStr);
      if (!isNaN(e.getTime())) {
        e.setUTCHours(23, 59, 59, 999);
        endIso = e.toISOString();
      }
    }

    const records: HealthLogRecord[] = [];

    if (this.client) {
      try {
        const filter = `PartitionKey eq '${PARTITION_KEY}' and RowKey ge '${startIso}' and RowKey le '${endIso}_z'`;
        const entities = this.client.listEntities<TableEntity>({
          queryOptions: { filter }
        });

        for await (const entity of entities) {
          records.push({
            partitionKey: entity.partitionKey as string,
            rowKey: entity.rowKey as string,
            type: entity.type as 'food' | 'activity',
            name: entity.name as string,
            calories: Number(entity.calories || 0),
            protein: Number(entity.protein || 0),
            carbs: Number(entity.carbs || 0),
            fat: Number(entity.fat || 0),
            fiber: Number(entity.fiber || 0),
            sugar: Number(entity.sugar || 0),
            sodiumMg: Number(entity.sodiumMg || 0),
            mealType: (entity.mealType as any) || 'snack',
            durationMin: Number(entity.durationMin || 0),
            metValue: Number(entity.metValue || 0),
            activeCalories: Number(entity.activeCalories || 0),
            modality: (entity.modality as any) || 'none',
            intensity: (entity.intensity as any) || 'none',
            servingInfo: (entity.servingInfo as string) || '',
            details: (entity.details as string) || '',
            rawInput: (entity.rawInput as string) || '',
            timestamp: (entity.timestamp as string) || entity.rowKey
          });
        }
      } catch (err: any) {
        console.error('Error querying Azure Table Storage, returning memory store:', err.message);
      }
    }

    // Always merge in any memory store records matching timeframe
    for (const [_, rec] of localMemoryStore) {
      if (rec.rowKey >= startIso && rec.rowKey <= `${endIso}_z`) {
        if (!records.some(r => r.rowKey === rec.rowKey)) {
          records.push(rec);
        }
      }
    }

    // Return in reverse chronological order (newest first)
    return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async deleteLog(partitionKey: string, rowKey: string): Promise<boolean> {
    await this.ensureTable();

    let deleted = false;
    if (this.client) {
      try {
        await this.client.deleteEntity(partitionKey || PARTITION_KEY, rowKey);
        deleted = true;
      } catch (err: any) {
        console.warn('Error deleting from Azure Table Storage:', err.message);
      }
    }

    if (localMemoryStore.has(rowKey)) {
      localMemoryStore.delete(rowKey);
      deleted = true;
    }

    return deleted;
  }
}

export const tableService = new HealthTableService();
