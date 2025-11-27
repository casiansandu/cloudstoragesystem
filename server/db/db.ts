import pgPromise from 'pg-promise';
import { IDatabase, IMain } from 'pg-promise';
import { DB_NAME, DB_USERNAME, DB_PASSWORD } from '../config/config';
import { User, Session } from '../types';

const pgp: IMain = pgPromise();

interface DatabaseSchema {
  users: User;
  sessions: Session;
}

const db: IDatabase<DatabaseSchema> = pgp({
  host: 'localhost',
  port: 5432,
  database: DB_NAME,
  user: DB_USERNAME,
  password: DB_PASSWORD
});

export default db;
