// expo-sqlite no navegador para a captura: mesma API síncrona usada pelo app, sobre sql.js em memória.
function params(list) {
  if (list.length === 1 && (Array.isArray(list[0]) || (list[0] && typeof list[0] === 'object'))) return list[0];
  return list;
}

function wrap(raw) {
  const all = (sql, ...args) => {
    const stmt = raw.prepare(sql);
    stmt.bind(params(args));
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  return {
    execSync: (sql) => {
      raw.exec(sql);
    },
    runSync: (sql, ...args) => {
      raw.run(sql, params(args));
      return { changes: raw.getRowsModified(), lastInsertRowId: 0 };
    },
    getAllSync: all,
    getFirstSync: (sql, ...args) => all(sql, ...args)[0] ?? null,
    withTransactionSync: (fn) => {
      raw.exec('BEGIN');
      try {
        fn();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

let db = null;
module.exports = {
  openDatabaseSync: () => db || (db = wrap(new globalThis.__SQLJS.Database())),
};
