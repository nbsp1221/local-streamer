/**
 * Base repository interface defining common CRUD operations
 */
export interface BaseRepository<T, CreateInput, UpdateInput> {
  /**
   * Find all entities
   */
  findAll(): Promise<T[]>;

  /**
   * Find entity by ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Create new entity
   */
  create(input: CreateInput): Promise<T>;

  /**
   * Update existing entity
   */
  update(id: string, updates: UpdateInput): Promise<T | null>;

  /**
   * Delete entity by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if entity exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Count total entities
   */
  count(): Promise<number>;
}
