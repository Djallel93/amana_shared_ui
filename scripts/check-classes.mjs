#!/usr/bin/env node
// scripts/check-classes.mjs
// Garde-fou Tailwind 4 (14/10/2026) : refuse les utilitaires supprimés en v4
// et les directives v3 dans les sources du package.
//
// Usage : npm run check:classes            (src/ et styles/)
//         node scripts/check-classes.mjs <dossier|fichier> [...]
// Code de sortie : 0 = propre, 1 = au moins un jeton interdit.
//
// Liste établie à partir du guide de migration Tailwind 4
// (tailwindcss.com/docs/upgrade-guide, « Removed utilities »). Les noms
// simplement renommés dont le comportement est conservé par le pont
// @config (shadow, shadow-sm, rounded, rounded-sm… — échelles surchargées
// par tailwind-preset.js) ne sont volontairement PAS interdits.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const EXTENSIONS = new Set(['.vue', '.ts', '.js', '.mjs', '.css', '.html', '.php']);
const B = String.raw`(?<![\w-])`; // début de jeton
const E = String.raw`(?![\w-])`; // fin de jeton

const DENY = [
    [new RegExp(`${B}flex-shrink(?:-\\d+)?${E}`, 'g'), 'flex-shrink-* → shrink-*'],
    [new RegExp(`${B}flex-grow(?:-\\d+)?${E}`, 'g'), 'flex-grow-* → grow-*'],
    [new RegExp(`${B}outline-none${E}`, 'g'), 'outline-none → outline-hidden (D10)'],
    [new RegExp(`${B}overflow-ellipsis${E}`, 'g'), 'overflow-ellipsis → text-ellipsis'],
    [new RegExp(`${B}decoration-(?:slice|clone)${E}`, 'g'), 'decoration-slice/clone → box-decoration-*'],
    [new RegExp(`${B}(?:bg|text|border|divide|ring|placeholder)-opacity-\\d+${E}`, 'g'), '*-opacity-N → modificateur /N'],
    [new RegExp(`${B}backdrop-blur-sm${E}`, 'g'), 'backdrop-blur-sm (4px en v3, 8px en v4) → backdrop-blur-xs'],
    [new RegExp(`${B}(?:drop-shadow|blur)-sm${E}`, 'g'), 'blur-sm / drop-shadow-sm : valeur décalée en v4 → -xs'],
    [/@tailwind\s+(?:base|components|utilities)\b/g, '@tailwind … → @import "tailwindcss"'],
];

function* walk(path) {
    const st = statSync(path);
    if (st.isFile()) {
        if (EXTENSIONS.has(extname(path))) yield path;
        return;
    }
    for (const name of readdirSync(path)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        yield* walk(join(path, name));
    }
}

export function scan(roots) {
    const hits = [];
    for (const root of roots) {
        for (const file of walk(root)) {
            const lines = readFileSync(file, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (line.length > 2000) return; // CSS inliné : hors périmètre
                for (const [rx, hint] of DENY) {
                    rx.lastIndex = 0;
                    for (const m of line.matchAll(rx)) {
                        hits.push({ file, line: i + 1, token: m[0], hint });
                    }
                }
            });
        }
    }
    return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const roots = process.argv.slice(2);
    const hits = scan(roots.length ? roots : ['src', 'styles']);
    for (const h of hits) console.error(`${h.file}:${h.line}  ${h.token}  →  ${h.hint}`);
    if (hits.length) {
        console.error(`\n${hits.length} jeton(s) interdit(s) pour Tailwind 4.`);
        process.exit(1);
    }
    console.log('check:classes : aucun jeton interdit.');
}
