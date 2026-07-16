# script-journal

Ejecuta un módulo de script JS, escribe los datos devueltos en un archivo JSON y el registro de ejecución en un archivo de log.

**Otros idiomas:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install script-journal
```

## Uso

```ts
import { runScript } from "script-journal";

const result = await runScript("/path/to/my-task.mjs", {
  root: "/output",
  filePath: "reports/daily", // opcional, por defecto "output"
});

// Archivos de salida:
//   /output/reports/daily.json  ← valor devuelto por el script
//   /output/reports/daily.log   ← registro de ejecución
```

### Formato del script

El script debe exportar una función como `default export` (sync o async). El valor devuelto se persistirá en JSON:

```js
// my-task.mjs
export default async function () {
  const data = await fetchSomething();
  return data;
}
```

También se admite el formato CommonJS:

```js
// my-task.js
module.exports = async function () {
  return { status: "ok", timestamp: Date.now() };
};
```

## API

### `runScript(scriptFile, options)`

#### Parámetros

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `scriptFile` | `string` | ✅ | Ruta absoluta al archivo de script que se ejecutará |
| `options.root` | `string` | ✅ | Directorio raíz de salida |
| `options.filePath` | `string` | ❌ | Ruta relativa (sin extensión), admite subdirectorios, por defecto `"output"` |

#### Valor de retorno `ScriptJournalResult<T>`

| Campo | Tipo | Descripción |
|---|---|---|
| `success` | `boolean` | Si el script se ejecutó correctamente (sin lanzar excepciones) |
| `data` | `T` | Valor devuelto por la función del script (solo cuando `success=true`) |
| `error` | `string` | Mensaje de error/stack (solo cuando `success=false`) |
| `startedAt` | `string` | Hora de inicio (cadena ISO) |
| `finishedAt` | `string` | Hora de finalización (cadena ISO) |
| `durationMs` | `number` | Duración de ejecución en milisegundos |
| `jsonPath` | `string` | Ruta absoluta al archivo JSON de salida |
| `logPath` | `string` | Ruta absoluta al archivo de log de salida |

### Limpieza de archivos

Antes de cada ejecución, los archivos `.json` y `.log` existentes en la ruta especificada se **eliminan automáticamente**, garantizando resultados limpios en cada ejecución.

## Licencia

MIT
