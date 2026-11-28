// Entrada do build web (demo pública e capturas): carrega o SQLite em memória (sql.js) antes do app,
// porque o app abre o banco de forma síncrona na inicialização.
import { registerRootComponent } from 'expo';

const initSqlJs = require('sql.js/dist/sql-asm.js');

initSqlJs().then((SQL) => {
  globalThis.__SQLJS = SQL;
  const App = require('./src/app/App').default;
  registerRootComponent(App);
});
