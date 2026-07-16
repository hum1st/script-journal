# script-journal

Exécute un module de script JS, écrit les données retournées dans un fichier JSON et le journal d'exécution dans un fichier de log.

**Autres langues :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install script-journal
```

## Utilisation

```ts
import { runScript } from "script-journal";

const result = await runScript("/path/to/my-task.mjs", {
  root: "/output",
  filePath: "reports/daily", // optionnel, par défaut "output"
});

// Fichiers de sortie :
//   /output/reports/daily.json  ← valeur retournée par le script
//   /output/reports/daily.log   ← journal d'exécution
```

### Format du script

Le script doit exporter une fonction en `default export` (sync ou async). La valeur retournée sera persistée en JSON :

```js
// my-task.mjs
export default async function () {
  const data = await fetchSomething();
  return data;
}
```

Le format CommonJS est également supporté :

```js
// my-task.js
module.exports = async function () {
  return { status: "ok", timestamp: Date.now() };
};
```

## API

### `runScript(scriptFile, options)`

#### Paramètres

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `scriptFile` | `string` | ✅ | Chemin absolu vers le fichier de script à exécuter |
| `options.root` | `string` | ✅ | Répertoire racine de sortie |
| `options.filePath` | `string` | ❌ | Chemin relatif (sans extension), prend en charge les sous-répertoires, par défaut `"output"` |

#### Valeur de retour `ScriptJournalResult<T>`

| Champ | Type | Description |
|---|---|---|
| `success` | `boolean` | Si le script s'est exécuté avec succès (sans lever d'exception) |
| `data` | `T` | Valeur retournée par la fonction du script (uniquement si `success=true`) |
| `error` | `string` | Message d'erreur/stack (uniquement si `success=false`) |
| `startedAt` | `string` | Heure de début (chaîne ISO) |
| `finishedAt` | `string` | Heure de fin (chaîne ISO) |
| `durationMs` | `number` | Durée d'exécution en millisecondes |
| `jsonPath` | `string` | Chemin absolu vers le fichier JSON de sortie |
| `logPath` | `string` | Chemin absolu vers le fichier de log de sortie |

### Nettoyage des fichiers

Avant chaque exécution, les fichiers `.json` et `.log` existants au chemin spécifié sont **automatiquement supprimés**, garantissant des résultats propres à chaque exécution.

## Licence

MIT
