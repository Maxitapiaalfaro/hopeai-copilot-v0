import { Db, Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from './mongodb';
import { User, Session, Patient, File, ChangeLog, SyncConflict } from './models';

export class DatabaseService {
  private _db: Db | null = null;

  async initialize(): Promise<void> {
    this._db = await connectToDatabase();
  }

  // Expose the connected Db instance for diagnostics and advanced operations
  get db(): Db {
    if (!this._db) throw new Error('Database not initialized');
    return this._db;
  }

  get users(): Collection<User> {
    if (!this._db) throw new Error('Database not initialized');
    return this._db.collection<User>('users');
  }

  get sessions(): Collection<Session> {
    if (!this._db) throw new Error('Database not initialized');
    return this._db.collection<Session>('sessions');
  }

  get patients(): Collection<Patient> {
    if (!this._db) throw new Error('Database not initialized');
    return this._db.collection<Patient>('patients');
  }

  get files(): Collection<File> {
    if (!this._db) throw new Error('Database not initialized');
    return this._db.collection<File>('files');
  }

  get changeLogs(): Collection<ChangeLog> {
    if (!this._db) throw new Error('Database not initialized');
    return this._db.collection<ChangeLog>('changeLogs');
  }

  get syncConflicts(): Collection<SyncConflict> {
    if (!this._db) throw new Error('Database not initialized');
    return this._db.collection<SyncConflict>('syncConflicts');
  }

  // Helper method to convert string ID to ObjectId
  toObjectId(id: string): ObjectId {
    return new ObjectId(id);
  }

  // Helper method to generate unique IDs
  generateId(): string {
    return new ObjectId().toString();
  }
}

// Singleton instance
export const databaseService = new DatabaseService();