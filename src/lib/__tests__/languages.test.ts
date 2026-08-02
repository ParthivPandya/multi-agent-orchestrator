// ============================================================
// Unit Tests — Language Skills Registry
// Tests language detection, skill prompts, and language listing.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  getSkillPrompt,
  getAllLanguages,
  LANGUAGE_SKILLS,
  type SupportedLanguage,
} from '@/lib/skills/languages';

describe('detectLanguage', () => {
  it('detects TypeScript from React/Next.js keywords', () => {
    expect(detectLanguage('Build a Next.js web app with TypeScript')).toBe('typescript');
    expect(detectLanguage('Create a React frontend')).toBe('typescript');
  });

  it('detects Python from ML/Django keywords', () => {
    expect(detectLanguage('Build a FastAPI REST API with Python')).toBe('python');
    expect(detectLanguage('Train a machine learning model with PyTorch')).toBe('python');
    expect(detectLanguage('Create a Django app with SQLAlchemy')).toBe('python');
  });

  it('detects Go from golang keywords', () => {
    expect(detectLanguage('Build a Go microservice with Gin')).toBe('go');
    expect(detectLanguage('Create a golang gRPC server')).toBe('go');
  });

  it('detects Java from Spring/enterprise keywords', () => {
    expect(detectLanguage('Build a Spring Boot REST API with Java')).toBe('java');
    expect(detectLanguage('Create an enterprise Kafka consumer')).toBe('java');
  });

  it('detects Rust from systems/axum keywords', () => {
    expect(detectLanguage('Build a Rust CLI tool with tokio')).toBe('rust');
    expect(detectLanguage('Create an axum web server')).toBe('rust');
  });

  it('detects Ruby from Rails keywords', () => {
    expect(detectLanguage('Build a Ruby on Rails app')).toBe('ruby');
    expect(detectLanguage('Create an ActiveRecord model')).toBe('ruby');
  });

  it('detects PHP from Laravel keywords', () => {
    expect(detectLanguage('Build a PHP Laravel application')).toBe('php');
    expect(detectLanguage('Create a PHP app with Eloquent and Composer')).toBe('php');
  });

  it('defaults to TypeScript for ambiguous input', () => {
    expect(detectLanguage('Build a REST API for a todo app')).toBe('typescript');
    expect(detectLanguage('Create something cool')).toBe('typescript');
  });

  it('is case-insensitive', () => {
    expect(detectLanguage('BUILD A PYTHON API')).toBe('python');
    expect(detectLanguage('Create a GOLANG Server')).toBe('go');
  });

  it('picks the language with most keyword matches', () => {
    // "python fastapi pydantic" has 3 Python matches vs 0 for others
    expect(detectLanguage('Build a Python FastAPI app with Pydantic models')).toBe('python');
  });
});

describe('getSkillPrompt', () => {
  it('returns a non-empty prompt for each language', () => {
    const languages: SupportedLanguage[] = ['typescript', 'python', 'go', 'java', 'rust', 'ruby', 'php'];
    for (const lang of languages) {
      const prompt = getSkillPrompt(lang);
      expect(prompt.length).toBeGreaterThan(50);
      expect(prompt).toContain('## Language:');
    }
  });

  it('TypeScript prompt mentions strict mode', () => {
    expect(getSkillPrompt('typescript')).toContain('strict');
  });

  it('Python prompt mentions PEP 8', () => {
    expect(getSkillPrompt('python')).toContain('PEP 8');
  });

  it('Go prompt mentions error handling', () => {
    expect(getSkillPrompt('go')).toContain('Error handling');
  });

  it('Rust prompt mentions unwrap warning', () => {
    expect(getSkillPrompt('rust')).toContain('.unwrap()');
  });
});

describe('getAllLanguages', () => {
  it('returns all 7 supported languages', () => {
    const languages = getAllLanguages();
    expect(languages).toHaveLength(7);
  });

  it('each language has required fields', () => {
    for (const lang of getAllLanguages()) {
      expect(lang.language).toBeTruthy();
      expect(lang.displayName).toBeTruthy();
      expect(lang.icon).toBeTruthy();
      expect(lang.frameworks.length).toBeGreaterThan(0);
      expect(lang.fileExtensions.length).toBeGreaterThan(0);
      expect(lang.testFramework).toBeTruthy();
      expect(lang.packageManager).toBeTruthy();
      expect(lang.keywords.length).toBeGreaterThan(0);
      expect(lang.promptInjection.length).toBeGreaterThan(0);
    }
  });
});

describe('LANGUAGE_SKILLS registry', () => {
  it('has entries for all 7 languages', () => {
    const expectedKeys: SupportedLanguage[] = ['typescript', 'python', 'go', 'java', 'rust', 'ruby', 'php'];
    for (const key of expectedKeys) {
      expect(LANGUAGE_SKILLS[key]).toBeDefined();
    }
  });
});
