import type { BaseRepository } from '~/repositories/interfaces/BaseRepository';
import { jsonWriteQueue, JsonWriteQueue } from '~/repositories/utils/JsonWriteQueue';

/**
 * Abstract base class for JSON-based repositories
 * Provides common functionality for CRUD operations with safe concurrent writes
 */
export abstract class BaseJsonRepository<T extends { id: string; addedAt?: Date }, CreateInput, UpdateInput>
implements BaseRepository<T, CreateInput, UpdateInput> {
  protected writeQueue: JsonWriteQueue;

  /**
   * Path to the JSON file for this repository
   */
  protected abstract readonly filePath: string;

  constructor(writeQueue?: JsonWriteQueue) {
    this.writeQueue = writeQueue || jsonWriteQueue;
  }

  /**
   * Transform raw JSON data to entity (handle Date objects, etc.)
   */
  protected abstract transformFromJson(data: any): T;

  /**
   * Transform entity to JSON data (handle Date objects, etc.)
   */
  protected abstract transformToJson(entity: T): any;

  /**
   * Create a new entity from input data
   */
  protected abstract createEntity(input: CreateInput): T;

  /**
   * Get default empty array for this repository
   */
  protected getDefaultData(): T[] {
    return [];
  }

  /**
   * Read all entities from JSON file
   */
  protected async readAllFromFile(): Promise<T[]> {
    await this.writeQueue.ensureFile(this.filePath, this.getDefaultData());

    const rawData = await this.writeQueue.readJson<any[]>(this.filePath, this.getDefaultData());

    return rawData.map(item => this.transformFromJson(item));
  }

  /**
   * Write all entities to JSON file
   */
  protected async writeAllToFile(entities: T[]): Promise<void> {
    const jsonData = entities.map(entity => this.transformToJson(entity));
    await this.writeQueue.writeJson(this.filePath, jsonData);
  }

  /**
   * Find all entities
   */
  async findAll(): Promise<T[]> {
    return this.readAllFromFile();
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    const entities = await this.readAllFromFile();
    return entities.find(entity => entity.id === id) || null;
  }

  /**
   * Create new entity
   */
  async create(input: CreateInput): Promise<T> {
    const entities = await this.readAllFromFile();
    const newEntity = this.createEntity(input);

    // Add to beginning of array (newest first)
    entities.unshift(newEntity);

    await this.writeAllToFile(entities);
    return newEntity;
  }

  /**
   * Update existing entity
   */
  async update(id: string, updates: UpdateInput): Promise<T | null> {
    const entities = await this.readAllFromFile();
    const entityIndex = entities.findIndex(entity => entity.id === id);

    if (entityIndex === -1) {
      return null;
    }

    const existingEntity = entities[entityIndex];

    // Merge updates while preserving id and addedAt
    const updatedEntity = {
      ...existingEntity,
      ...updates,
      id: existingEntity.id,
      addedAt: existingEntity.addedAt,
    } as T;

    entities[entityIndex] = updatedEntity;
    await this.writeAllToFile(entities);

    return updatedEntity;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const entities = await this.readAllFromFile();
    const initialLength = entities.length;

    const filteredEntities = entities.filter(entity => entity.id !== id);

    if (filteredEntities.length === initialLength) {
      return false; // Entity not found
    }

    await this.writeAllToFile(filteredEntities);
    return true;
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  /**
   * Count total entities
   */
  async count(): Promise<number> {
    const entities = await this.readAllFromFile();
    return entities.length;
  }

  /**
   * Find entities by predicate function
   */
  protected async findWhere(predicate: (entity: T) => boolean): Promise<T[]> {
    const entities = await this.readAllFromFile();
    return entities.filter(predicate);
  }

  /**
   * Find first entity by predicate function
   */
  protected async findOneWhere(predicate: (entity: T) => boolean): Promise<T | null> {
    const entities = await this.readAllFromFile();
    return entities.find(predicate) || null;
  }
}
