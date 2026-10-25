// backend/src/shared/utils/skillSearch.js
// Matching helpers for the curated skills list: normalisation, aliases and ranking.
// Aliases map common variants to the canonical skill name stored in the `skills` table,
// so "python3" or "reactjs" find "Python" / "React" instead of creating look-alikes.

'use strict';

const ALIASES = {
  python3: 'Python',
  py: 'Python',
  reactjs: 'React',
  'react.js': 'React',
  node: 'Node.js',
  nodejs: 'Node.js',
  nextjs: 'Next.js',
  js: 'JavaScript',
  ecmascript: 'JavaScript',
  ts: 'TypeScript',
  golang: 'Go',
  k8s: 'Kubernetes',
  postgres: 'PostgreSQL',
  psql: 'PostgreSQL',
  mongo: 'MongoDB',
  amazonwebservices: 'AWS',
  googlecloud: 'GCP',
  googlecloudplatform: 'GCP',
  ml: 'Machine Learning',
  dl: 'Deep Learning',
  cv: 'Computer Vision',
  nlp: 'NLP',
  naturallanguageprocessing: 'NLP',
  ux: 'UI/UX Design',
  ui: 'UI/UX Design',
  uiux: 'UI/UX Design',
  restapi: 'REST APIs',
  restapis: 'REST APIs',
  rest: 'REST APIs',
  dsa: 'Data Structures',
  datastructuresandalgorithms: 'Data Structures',
  cicd: 'CI/CD',
  expressjs: 'Express',
  springboot: 'Spring Boot',
  cpp: 'C++',
  csharp: 'C#',
  powerbi: 'Power BI',
};

/** Lowercase and drop everything except letters, digits, '+' and '#' ("Node.js" → "nodejs"). */
function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, '');
}

/**
 * Rank a skill against a query: lower is better, null means no match.
 *  0 exact (or alias of this skill) · 1 prefix · 2 word-start · 3 contains
 */
function scoreSkill(skillName, query) {
  const q = normalize(query);
  if (!q) return 0;

  const n = normalize(skillName);
  const aliasTarget = ALIASES[q] ? normalize(ALIASES[q]) : null;

  if (n === q || n === aliasTarget) return 0;
  if (n.startsWith(q)) return 1;

  const rawQuery = String(query).trim().toLowerCase();
  const wordStart = String(skillName)
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .some((word) => word.startsWith(rawQuery));
  if (wordStart) return 2;

  if (n.includes(q)) return 3;
  return null;
}

/** Filter and order skills ({ id, name }) for a search query. */
function searchSkills(skills, query, limit) {
  const ranked = [];
  for (const skill of skills) {
    const score = scoreSkill(skill.name, query);
    if (score !== null) ranked.push({ skill, score });
  }
  ranked.sort((a, b) => a.score - b.score || a.skill.name.localeCompare(b.skill.name));
  return ranked.slice(0, limit).map((r) => r.skill);
}

module.exports = { normalize, searchSkills };
