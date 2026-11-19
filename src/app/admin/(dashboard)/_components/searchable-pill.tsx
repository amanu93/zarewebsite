'use client';

import { TagsInput } from '@mantine/core';

/**
 * Common tech skills shown as autocomplete suggestions in the job form.
 * These are only hints — the admin can type anything and press Enter (or
 * comma) to add it as a pill.
 */
const DEFAULT_SKILL_SUGGESTIONS = [
  // Languages
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'Kotlin',
  'Swift',
  'Go',
  'Rust',
  'C',
  'C++',
  'C#',
  'PHP',
  'Ruby',
  'Scala',
  'Dart',
  'SQL',
  // Frontend
  'React',
  'Next.js',
  'Vue',
  'Nuxt',
  'Angular',
  'Svelte',
  'SolidJS',
  'React Native',
  'Flutter',
  'HTML',
  'CSS',
  'Tailwind CSS',
  'SASS',
  'Redux',
  'Zustand',
  // Backend / runtimes
  'Node.js',
  'NestJS',
  'Express',
  'Django',
  'FastAPI',
  'Flask',
  'Spring Boot',
  'Laravel',
  'Ruby on Rails',
  '.NET',
  'GraphQL',
  'REST APIs',
  // Data / infra
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'Terraform',
  'CI/CD',
  'Linux',
  // Design / product
  'Figma',
  'UI/UX Design',
  'Product Management',
  'Agile',
  'Scrum',
  'JIRA',
];

/**
 * Free-form tag input for job skills. Admins can type anything and press
 * Enter or comma to add it as a pill; a curated list of common tech skills
 * is offered as autocomplete suggestions.
 */
export function SearchablePill({
  value,
  setValue,
  suggestions = DEFAULT_SKILL_SUGGESTIONS,
}: {
  value: string[];
  setValue: (val: string[]) => void;
  suggestions?: string[];
}) {
  return (
    <TagsInput
      data={suggestions}
      value={value}
      onChange={setValue}
      placeholder={
        value.length === 0 ? 'Type a skill and press Enter…' : undefined
      }
      splitChars={[',', 'Enter']}
      clearable
      acceptValueOnBlur
      size="md"
      styles={{
        input: {
          backgroundColor: '#ffffff',
          borderColor: '#e7eaee',
        },
      }}
    />
  );
}
