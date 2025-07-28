import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const openDb = async () => {
  const dbPath = path.join('/app/shared', 'database.db');

  return await open({
      filename: dbPath,
      driver: sqlite3.Database
  });
};

export { openDb }