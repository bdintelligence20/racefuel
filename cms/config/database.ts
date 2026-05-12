import path from 'path';

/**
 * SQLite-only configuration. In local dev the DB lives under `.tmp/`; in
 * production it lives on a GCS volume mounted at /data inside the container.
 *
 * The Cloud Run service must run with `--execution-environment=gen2` and
 * `--max-instances=1` so the SQLite file isn't written by two instances at
 * once — concurrent writers over GCS FUSE corrupts the database.
 */
export default ({ env }) => ({
  connection: {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(env('DATABASE_FILENAME', '.tmp/data.db')),
    },
    useNullAsDefault: true,
  },
});
