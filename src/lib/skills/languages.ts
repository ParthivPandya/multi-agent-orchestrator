// ============================================================
// Feature 5 — Multi-Language Skills Registry
// Language-specific patterns, idioms, and best practices are
// injected into the Developer Agent system prompt at runtime.
// Supports: TypeScript, Python, Go, Java, Rust, Ruby, PHP
// ============================================================

export type SupportedLanguage =
  | 'typescript'
  | 'python'
  | 'go'
  | 'java'
  | 'rust'
  | 'ruby'
  | 'php';

export interface LanguageSkill {
  language: SupportedLanguage;
  displayName: string;
  icon: string;
  frameworks: string[];
  promptInjection: string;   // Injected into Developer system prompt
  fileExtensions: string[];
  testFramework: string;
  packageManager: string;
  keywords: string[];         // Used for auto-detection from requirements
}

export const LANGUAGE_SKILLS: Record<SupportedLanguage, LanguageSkill> = {
  typescript: {
    language: 'typescript',
    displayName: 'TypeScript / Node.js',
    icon: '🟦',
    frameworks: ['Next.js', 'Express', 'NestJS', 'Fastify', 'Hono'],
    fileExtensions: ['.ts', '.tsx'],
    testFramework: 'Jest / Vitest',
    packageManager: 'npm / pnpm',
    keywords: ['typescript', 'nextjs', 'next.js', 'react', 'node', 'express', 'nestjs', 'javascript', 'ts', 'tsx', 'frontend', 'web app', 'api', 'rest api'],
    promptInjection: `
## Language: TypeScript / Node.js
- Use strict TypeScript (tsconfig: strict:true). All types must be explicit — no implicit any.
- Prefer interfaces over type aliases for object shapes.
- Use async/await. Never mix callbacks and promises.
- Error handling: typed errors, never throw raw strings.
- Use Zod for runtime validation of external inputs/API bodies.
- Structure: barrel exports (index.ts), co-locate tests with source.
- For APIs: separate route handlers, controllers, services, and data-access layers.
- For Next.js: use App Router (src/app/), Server Components by default, "use client" sparingly.
- Package.json scripts must include: dev, build, test, lint.
- Include tsconfig.json with strict settings.
`,
  },

  python: {
    language: 'python',
    displayName: 'Python',
    icon: '🐍',
    frameworks: ['FastAPI', 'Django', 'Flask', 'Celery', 'SQLAlchemy'],
    fileExtensions: ['.py'],
    testFramework: 'pytest',
    packageManager: 'pip / poetry',
    keywords: ['python', 'fastapi', 'django', 'flask', 'ml', 'ai', 'machine learning', 'data science', 'pandas', 'numpy', 'pytorch', 'tensorflow', 'pydantic', 'celery', 'py', 'asyncio', 'sqlalchemy'],
    promptInjection: `
## Language: Python
- Follow PEP 8 strictly. Max line length 88 chars (Black formatter style).
- Type hints on ALL function signatures (PEP 484). Use from __future__ import annotations.
- Use Pydantic models for all request/response validation and config.
- Prefer dataclasses or Pydantic over plain dicts for structured data.
- Async: use async def consistently with asyncio. Never mix sync/async DB calls.
- Error handling: custom exception classes, never bare except clauses.
- Structure: src layout (src/myapp/), routers/ services/ models/ schemas/ core/ dirs.
- For FastAPI: separate routers per domain, use Depends() for DI, APIRouter prefix.
- For Django: use class-based views, separate apps per domain, use signals sparingly.
- Include requirements.txt AND pyproject.toml. Always pin major versions.
- Tests: pytest fixtures, use pytest-asyncio for async tests, aim for 80%+ coverage.
- Include Makefile with: install, dev, test, lint, format targets.
`,
  },

  go: {
    language: 'go',
    displayName: 'Go',
    icon: '🐹',
    frameworks: ['Gin', 'Echo', 'Fiber', 'chi', 'stdlib net/http'],
    fileExtensions: ['.go'],
    testFramework: 'testing (stdlib) + testify',
    packageManager: 'go mod',
    keywords: ['go', 'golang', 'gin', 'echo', 'fiber', 'microservice', 'grpc', 'protobuf', 'goroutine', 'channel'],
    promptInjection: `
## Language: Go
- Follow effective Go idioms: https://go.dev/doc/effective_go
- Error handling: always check errors, wrap with fmt.Errorf("context: %w", err).
- Never panic in production code paths — return errors to callers.
- Use interfaces for abstraction. Prefer small, focused interfaces.
- Concurrency: goroutines + channels, use context.Context for cancellation/timeouts.
- Project structure: cmd/, internal/, pkg/, api/ layout. Main in cmd/server/main.go.
- Dependency injection via constructor functions, not global state.
- Use go.mod with explicit module path. Include go.sum.
- HTTP handlers: separate handler/service/repository layers.
- Tests: Table-driven tests in _test.go files, use testify/assert for assertions.
- Include Makefile with: build, run, test, lint (golangci-lint), docker targets.
- Dockerfile: multi-stage build (builder → distroless scratch final image).
`,
  },

  java: {
    language: 'java',
    displayName: 'Java / Spring Boot',
    icon: '☕',
    frameworks: ['Spring Boot', 'Spring Data JPA', 'Spring Security', 'Maven', 'Gradle'],
    fileExtensions: ['.java'],
    testFramework: 'JUnit 5 + Mockito',
    packageManager: 'Maven / Gradle',
    keywords: ['java', 'spring', 'spring boot', 'jpa', 'hibernate', 'maven', 'gradle', 'enterprise', 'microservice', 'rest api', 'soap', 'kafka', 'rabbitmq'],
    promptInjection: `
## Language: Java / Spring Boot
- Use Java 17+ features: records, sealed classes, pattern matching, text blocks.
- Follow Spring Boot 3.x conventions with Spring Data JPA and Spring Security.
- Project structure: com.company.app.{controller,service,repository,model,dto,config}.
- Use @RestController for APIs, @Service for business logic, @Repository for data access.
- DTOs: separate request/response objects from JPA entities. Use MapStruct for mapping.
- Validation: Jakarta Validation (@Valid, @NotNull, @Size) on DTOs.
- Error handling: @ControllerAdvice + @ExceptionHandler for centralized error responses.
- Security: Spring Security with JWT or OAuth2. Never expose BCrypt cost < 10.
- Database: Flyway or Liquibase for migrations. Never auto-ddl=create in production.
- Tests: @SpringBootTest for integration, @WebMvcTest for controller, @DataJpaTest for repo.
- Include pom.xml (Maven) with Spring Boot starter parent and all dependencies declared.
- application.yml (not .properties) with profiles: dev, prod, test.
`,
  },

  rust: {
    language: 'rust',
    displayName: 'Rust',
    icon: '🦀',
    frameworks: ['Axum', 'Actix-web', 'Tokio', 'Serde', 'SQLx'],
    fileExtensions: ['.rs'],
    testFramework: 'cargo test + tokio::test',
    packageManager: 'cargo',
    keywords: ['rust', 'axum', 'actix', 'tokio', 'wasm', 'webassembly', 'systems', 'embedded', 'cli', 'performance', 'memory safe'],
    promptInjection: `
## Language: Rust
- Follow Rust idioms: prefer owned types over references where lifetimes get complex.
- Error handling: use thiserror for library errors, anyhow for application errors.
- NEVER use .unwrap() or .expect() in production paths — always propagate with ?.
- Async: use Tokio runtime. All async functions must be properly awaited.
- Project structure: src/lib.rs (library), src/main.rs (binary), src/handlers/, src/models/.
- Use Serde for serialization (derive Serialize, Deserialize on all data structs).
- For Axum: separate Router, handlers (functions), state (shared via Arc<AppState>).
- Database: SQLx with compile-time checked queries. Use sqlx::migrate!() for migrations.
- Modules: explicit pub, prefer pub(crate) over pub for internal APIs.
- Cargo.toml: declare all features explicitly. Use workspace for multi-crate projects.
- Tests: unit tests in #[cfg(test)] module, integration tests in tests/ directory.
- Include Dockerfile with cargo-chef for layer caching.
`,
  },

  ruby: {
    language: 'ruby',
    displayName: 'Ruby on Rails',
    icon: '💎',
    frameworks: ['Rails 7', 'Sinatra', 'RSpec', 'Sidekiq', 'Devise'],
    fileExtensions: ['.rb', '.erb'],
    testFramework: 'RSpec + FactoryBot',
    packageManager: 'Bundler (gem)',
    keywords: ['ruby', 'rails', 'ruby on rails', 'sinatra', 'activerecord', 'rspec', 'sidekiq', 'devise'],
    promptInjection: `
## Language: Ruby on Rails
- Use Rails 7.x conventions. Prefer Hotwire (Turbo + Stimulus) over heavy JS frameworks.
- Follow "fat model, skinny controller" — business logic in models or service objects.
- Service objects in app/services/ for complex operations. Plain Ruby classes.
- Use ActiveRecord scopes over raw SQL. Never N+1 queries — use includes/eager_load.
- Concerns for shared model/controller behavior (app/models/concerns/, app/controllers/concerns/).
- API-only mode: use Rails API mode, render JSON explicitly, use serializers (jsonapi-serializer).
- Background jobs: Sidekiq with ActiveJob adapter. Retries and dead-letter queues configured.
- Authentication: Devise for web apps, JWT (doorkeeper) for APIs.
- Tests: RSpec with FactoryBot fixtures. Use VCR cassettes for external API calls.
- Gemfile: pin major versions. Use Bundler groups (development, test, production).
- Include database.yml with PostgreSQL. Use strong_migrations gem.
`,
  },

  php: {
    language: 'php',
    displayName: 'PHP / Laravel',
    icon: '🐘',
    frameworks: ['Laravel 11', 'Symfony', 'Composer'],
    fileExtensions: ['.php'],
    testFramework: 'PHPUnit + Pest',
    packageManager: 'Composer',
    keywords: ['php', 'laravel', 'symfony', 'wordpress', 'composer', 'eloquent', 'artisan'],
    promptInjection: `
## Language: PHP / Laravel
- PHP 8.2+ with strict types (declare(strict_types=1) in all files).
- Use Laravel 11.x conventions. Never use global helpers in service classes.
- Structure: App\\Http\\Controllers (thin), App\\Services (business), App\\Repositories (data).
- Eloquent: use relationships (hasMany, belongsTo, etc.) over raw queries.
- Form Requests for validation. API Resources for response transformation.
- Queues: Laravel Queue with Redis driver. Horizon for monitoring.
- Auth: Laravel Sanctum (SPA/mobile), Passport (OAuth2 server).
- Tests: Pest (preferred over PHPUnit). Feature tests with database transactions.
- Migrations: descriptive names (create_users_table, add_email_verified_at_to_users).
- composer.json: lock PHP version constraint. Use spatie/* packages where appropriate.
- Include .env.example with all required variables. Never commit .env.
`,
  },
};

/**
 * Auto-detects the target language from requirement text.
 * Scores each language by keyword match count and returns the winner.
 * Falls back to TypeScript if nothing matches strongly.
 */
export function detectLanguage(requirement: string): SupportedLanguage {
  const lower = requirement.toLowerCase();
  const scores: Record<SupportedLanguage, number> = {
    typescript: 0,
    python: 0,
    go: 0,
    java: 0,
    rust: 0,
    ruby: 0,
    php: 0,
  };

  for (const [lang, skill] of Object.entries(LANGUAGE_SKILLS)) {
    for (const kw of skill.keywords) {
      if (lower.includes(kw)) {
        scores[lang as SupportedLanguage] += 1;
      }
    }
  }

  // Pick the highest scorer
  let best: SupportedLanguage = 'typescript';
  let bestScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = lang as SupportedLanguage;
    }
  }

  return best;
}

/**
 * Returns the language skill prompt injection string for a given language.
 * This is prepended/appended to the Developer agent system prompt.
 */
export function getSkillPrompt(language: SupportedLanguage): string {
  return LANGUAGE_SKILLS[language].promptInjection;
}

/**
 * Returns all languages as an array for UI dropdowns.
 */
export function getAllLanguages(): LanguageSkill[] {
  return Object.values(LANGUAGE_SKILLS);
}
