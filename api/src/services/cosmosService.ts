import { CosmosClient, Container, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { DraftEntry, HealthLogRecord, CosmosHealthDoc } from '../types/apiTypes';

const DEFAULT_DATABASE_ID = 'portfolio';
const DEFAULT_CONTAINER_ID = 'health_tracker';
const DEFAULT_USER_ID = 'default_user';

function generateDocId(date: Date = new Date()): string {
  const iso = date.toISOString().replace(/[:.]/g, '-');
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `log_${iso}_${randomSuffix}`;
}

export class HealthCosmosService {
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private container: Container | null = null;
  private databaseId: string;
  private containerId: string;
  private endpoint: string;

  constructor() {
    this.endpoint = process.env.COSMOS_ENDPOINT || 'https://cdb-portfolio.documents.azure.com:443/';
    this.databaseId = process.env.COSMOS_DATABASE_ID || DEFAULT_DATABASE_ID;
    this.containerId = process.env.COSMOS_CONTAINER_ID || DEFAULT_CONTAINER_ID;

    try {
      // Keyless managed identity authentication using DefaultAzureCredential
      const credential = new DefaultAzureCredential();
      this.client = new CosmosClient({
        endpoint: this.endpoint,
        aadCredentials: credential
      });
      this.database = this.client.database(this.databaseId);
      this.container = this.database.container(this.containerId);
    } catch (err: any) {
      console.error('Failed to initialize CosmosClient with DefaultAzureCredential:', err.message);
    }
  }

  private getContainer(): Container {
    if (!this.container) {
      if (!this.client) {
        const credential = new DefaultAzureCredential();
        this.client = new CosmosClient({
          endpoint: this.endpoint,
          aadCredentials: credential
        });
      }
      this.database = this.client.database(this.databaseId);
      this.container = this.database.container(this.containerId);
    }
    return this.container;
  }

  async insertEntry(
    entry: DraftEntry,
    rawInput: string = '',
    userId: string = DEFAULT_USER_ID
  ): Promise<HealthLogRecord> {
    const container = this.getContainer();
    const timestamp = new Date().toISOString();
    const date = timestamp.substring(0, 10);
    const id = generateDocId();

    const isFood = entry.type === 'food';

    const doc: CosmosHealthDoc = {
      id,
      userId,
      docType: 'log',
      date,
      type: entry.type,
      name: entry.name,
      calories: Number(entry.calories || 0),
      protein: Number(entry.protein || 0),
      carbs: Number(entry.carbs || 0),
      fat: Number(entry.fat || 0),
      fiber: Number(entry.fiber || 0),
      sugar: Number(entry.sugar || 0),
      sodiumMg: Number(entry.sodiumMg || 0),
      mealType: entry.mealType || 'snack',
      durationMin: Number(entry.durationMin || 0),
      metValue: Number(entry.metValue || 0),
      activeCalories: Number(entry.activeCalories || 0),
      modality: entry.modality || 'none',
      intensity: entry.intensity || 'none',
      servingInfo: entry.servingInfo || '',
      details: entry.details || '',
      rawInput,
      timestamp,
      // Backward-compatible fields
      rowKey: id,
      partitionKey: userId,
      // Structured sub-documents for NoSQL optimization
      ...(isFood
        ? {
            food: {
              mealType: entry.mealType || 'snack',
              servingInfo: entry.servingInfo || '',
              nutrients: {
                calories: Number(entry.calories || 0),
                protein: Number(entry.protein || 0),
                carbs: Number(entry.carbs || 0),
                fat: Number(entry.fat || 0),
                fiber: Number(entry.fiber || 0),
                sugar: Number(entry.sugar || 0),
                sodiumMg: Number(entry.sodiumMg || 0)
              }
            }
          }
        : {
            activity: {
              durationMin: Number(entry.durationMin || 0),
              metValue: Number(entry.metValue || 0),
              activeCalories: Number(entry.activeCalories || 0),
              modality: entry.modality || 'none',
              intensity: entry.intensity || 'none',
              details: entry.details || ''
            }
          }),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const { resource } = await container.items.create(doc);
    return (resource as unknown as HealthLogRecord) || doc;
  }

  async insertBatch(
    entries: DraftEntry[],
    rawInput: string = '',
    userId: string = DEFAULT_USER_ID
  ): Promise<HealthLogRecord[]> {
    const records: HealthLogRecord[] = [];
    for (const entry of entries) {
      const rec = await this.insertEntry(entry, rawInput, userId);
      records.push(rec);
    }
    return records;
  }

  async getLogs(
    startDateStr?: string,
    endDateStr?: string,
    userId: string = DEFAULT_USER_ID
  ): Promise<HealthLogRecord[]> {
    const container = this.getContainer();

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

    const querySpec = {
      query: `
        SELECT * FROM c 
        WHERE c.userId = @userId 
          AND c.docType = 'log' 
          AND c.timestamp >= @startIso 
          AND c.timestamp <= @endIso 
        ORDER BY c.timestamp DESC
      `,
      parameters: [
        { name: '@userId', value: userId },
        { name: '@startIso', value: startIso },
        { name: '@endIso', value: endIso }
      ]
    };

    const { resources } = await container.items
      .query<CosmosHealthDoc>(querySpec, { partitionKey: userId })
      .fetchAll();

    return (resources || []).map((doc) => ({
      ...doc,
      rowKey: doc.rowKey || doc.id,
      partitionKey: doc.partitionKey || doc.userId
    }));
  }

  async deleteLog(rowKeyOrId: string, partitionKeyOrUserId?: string): Promise<boolean> {
    const container = this.getContainer();
    const userId = partitionKeyOrUserId || DEFAULT_USER_ID;
    const id = rowKeyOrId;

    try {
      await container.item(id, userId).delete();
      return true;
    } catch (err: any) {
      if (err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async getProfile(userId: string = DEFAULT_USER_ID): Promise<any | null> {
    const container = this.getContainer();
    const id = `profile_${userId}`;
    try {
      const { resource } = await container.item(id, userId).read();
      return resource || null;
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async upsertProfile(profileData: any, userId: string = DEFAULT_USER_ID): Promise<any> {
    const container = this.getContainer();
    const id = `profile_${userId}`;
    const doc = {
      id,
      userId,
      docType: 'profile',
      ...profileData,
      updatedAt: new Date().toISOString()
    };
    const { resource } = await container.items.upsert(doc);
    return resource;
  }
}

export const cosmosService = new HealthCosmosService();
