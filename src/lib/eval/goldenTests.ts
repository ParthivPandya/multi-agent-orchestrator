// ============================================================
// Evaluation Harness — Golden Test Dataset
// Curated requirement→expected patterns test cases for
// deterministic regression testing (no LLM needed for eval).
// ============================================================

export interface GoldenTestCase {
  id: string;
  name: string;
  description: string;
  requirement: string;
  expectedPatterns: string[];       // Patterns that MUST appear in output
  forbiddenPatterns?: string[];     // Patterns that must NOT appear in output
  minOutputLength: number;          // Minimum acceptable output length
  expectedLanguage?: string;        // Expected detected language
  category: 'api' | 'frontend' | 'fullstack' | 'security' | 'data' | 'infrastructure';
}

export interface GoldenTestResult {
  testId: string;
  testName: string;
  passed: boolean;
  score: number;              // 0-100
  matchedPatterns: string[];
  missedPatterns: string[];
  forbiddenFound: string[];
  outputLength: number;
  details: string;
}

export interface GoldenTestSuiteResult {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;           // 0-100
  avgScore: number;           // 0-100
  results: GoldenTestResult[];
  executedAt: string;
}

// ─── Curated Golden Test Cases ───────────────────────────────

export const GOLDEN_TESTS: GoldenTestCase[] = [
  {
    id: 'gt-001',
    name: 'REST API CRUD',
    description: 'Basic REST API with CRUD operations',
    requirement: 'Build a REST API for a todo app with create, read, update, delete endpoints',
    expectedPatterns: ['GET', 'POST', 'PUT', 'DELETE', 'todo', 'endpoint', 'route'],
    forbiddenPatterns: ['TODO: implement', 'not implemented'],
    minOutputLength: 500,
    expectedLanguage: 'TypeScript',
    category: 'api',
  },
  {
    id: 'gt-002',
    name: 'Authentication System',
    description: 'JWT-based authentication',
    requirement: 'Create a JWT authentication system with login, register, and protected routes',
    expectedPatterns: ['JWT', 'token', 'auth', 'password', 'hash', 'middleware'],
    forbiddenPatterns: ['plain text password', 'hardcoded secret'],
    minOutputLength: 800,
    expectedLanguage: 'TypeScript',
    category: 'security',
  },
  {
    id: 'gt-003',
    name: 'React Dashboard',
    description: 'Admin dashboard with charts',
    requirement: 'Build a React admin dashboard with user analytics charts and data tables',
    expectedPatterns: ['React', 'component', 'chart', 'table', 'dashboard', 'useState'],
    minOutputLength: 600,
    expectedLanguage: 'TypeScript',
    category: 'frontend',
  },
  {
    id: 'gt-004',
    name: 'Database Schema',
    description: 'E-commerce database design',
    requirement: 'Design a PostgreSQL database schema for an e-commerce platform with users, products, orders, and reviews',
    expectedPatterns: ['CREATE TABLE', 'users', 'products', 'orders', 'FOREIGN KEY'],
    minOutputLength: 400,
    category: 'data',
  },
  {
    id: 'gt-005',
    name: 'Python FastAPI',
    description: 'Python API with FastAPI',
    requirement: 'Build a Python FastAPI application for a blog with posts and comments',
    expectedPatterns: ['FastAPI', 'def', 'async', 'post', 'comment', 'router'],
    minOutputLength: 500,
    expectedLanguage: 'Python',
    category: 'api',
  },
  {
    id: 'gt-006',
    name: 'CI/CD Pipeline',
    description: 'GitHub Actions workflow',
    requirement: 'Create a GitHub Actions CI/CD pipeline for a Node.js app with testing, linting, and deployment to AWS',
    expectedPatterns: ['github', 'actions', 'workflow', 'test', 'deploy', 'node'],
    minOutputLength: 300,
    category: 'infrastructure',
  },
  {
    id: 'gt-007',
    name: 'WebSocket Chat',
    description: 'Real-time chat application',
    requirement: 'Build a real-time chat application with WebSocket support, message history, and typing indicators',
    expectedPatterns: ['websocket', 'message', 'chat', 'connect', 'send'],
    minOutputLength: 600,
    category: 'fullstack',
  },
  {
    id: 'gt-008',
    name: 'Go Microservice',
    description: 'Go REST microservice',
    requirement: 'Create a Go microservice with a REST API for user management using Gin framework',
    expectedPatterns: ['func', 'gin', 'handler', 'user', 'http'],
    minOutputLength: 400,
    expectedLanguage: 'Go',
    category: 'api',
  },
  {
    id: 'gt-009',
    name: 'Rate Limiter',
    description: 'API rate limiting middleware',
    requirement: 'Implement a token bucket rate limiter middleware for an Express.js API',
    expectedPatterns: ['rate', 'limit', 'token', 'bucket', 'middleware', 'request'],
    minOutputLength: 300,
    category: 'security',
  },
  {
    id: 'gt-010',
    name: 'Docker Compose Stack',
    description: 'Multi-service Docker setup',
    requirement: 'Create a Docker Compose setup for a full-stack app with Next.js frontend, Node.js API, PostgreSQL database, and Redis cache',
    expectedPatterns: ['docker', 'compose', 'service', 'postgres', 'redis', 'port'],
    minOutputLength: 300,
    category: 'infrastructure',
  },
  {
    id: 'gt-011',
    name: 'File Upload Service',
    description: 'S3 file upload with validation',
    requirement: 'Build a file upload service with S3 storage, file type validation, virus scanning, and signed URLs',
    expectedPatterns: ['upload', 'file', 's3', 'validation', 'url'],
    minOutputLength: 500,
    category: 'api',
  },
  {
    id: 'gt-012',
    name: 'Search Engine',
    description: 'Full-text search with Elasticsearch',
    requirement: 'Implement a product search API with Elasticsearch, fuzzy matching, filters, and pagination',
    expectedPatterns: ['search', 'elastic', 'query', 'filter', 'pagination'],
    minOutputLength: 500,
    category: 'data',
  },
  {
    id: 'gt-013',
    name: 'Payment Integration',
    description: 'Stripe payment processing',
    requirement: 'Integrate Stripe payment processing with checkout, webhooks, and subscription management',
    expectedPatterns: ['stripe', 'payment', 'webhook', 'checkout', 'subscription'],
    forbiddenPatterns: ['hardcoded key', 'sk_live_'],
    minOutputLength: 600,
    category: 'fullstack',
  },
  {
    id: 'gt-014',
    name: 'Caching Layer',
    description: 'Redis caching strategy',
    requirement: 'Implement a Redis caching layer with cache invalidation, TTL, and cache-aside pattern',
    expectedPatterns: ['redis', 'cache', 'ttl', 'invalidat', 'key'],
    minOutputLength: 400,
    category: 'data',
  },
  {
    id: 'gt-015',
    name: 'Notification System',
    description: 'Multi-channel notifications',
    requirement: 'Build a notification service supporting email, SMS, and push notifications with templates and queuing',
    expectedPatterns: ['notification', 'email', 'template', 'queue', 'send'],
    minOutputLength: 500,
    category: 'fullstack',
  },
  {
    id: 'gt-016',
    name: 'Rust CLI Tool',
    description: 'Command-line application in Rust',
    requirement: 'Create a Rust CLI tool for batch processing CSV files with filtering, sorting, and export',
    expectedPatterns: ['fn', 'struct', 'csv', 'filter', 'cli'],
    minOutputLength: 400,
    expectedLanguage: 'Rust',
    category: 'api',
  },
  {
    id: 'gt-017',
    name: 'OAuth2 Provider',
    description: 'OAuth2 authorization server',
    requirement: 'Implement an OAuth2 authorization server with authorization code flow, refresh tokens, and scope management',
    expectedPatterns: ['oauth', 'token', 'authorization', 'scope', 'refresh'],
    minOutputLength: 700,
    category: 'security',
  },
  {
    id: 'gt-018',
    name: 'Event Sourcing',
    description: 'Event sourcing architecture',
    requirement: 'Design an event sourcing system for an order management service with event store, projections, and replay',
    expectedPatterns: ['event', 'store', 'projection', 'aggregate', 'replay'],
    minOutputLength: 600,
    category: 'data',
  },
  {
    id: 'gt-019',
    name: 'GraphQL API',
    description: 'GraphQL server with subscriptions',
    requirement: 'Build a GraphQL API for a social media app with queries, mutations, subscriptions, and DataLoader',
    expectedPatterns: ['graphql', 'query', 'mutation', 'resolver', 'type'],
    minOutputLength: 500,
    category: 'api',
  },
  {
    id: 'gt-020',
    name: 'Kubernetes Deployment',
    description: 'K8s manifests with HPA',
    requirement: 'Create Kubernetes deployment manifests for a microservice with HPA, health checks, secrets, and ingress',
    expectedPatterns: ['kind', 'Deployment', 'Service', 'container', 'port'],
    minOutputLength: 400,
    category: 'infrastructure',
  },
];

// ─── Test Runner ─────────────────────────────────────────────

/**
 * Run a single golden test against an output string.
 * This is deterministic — no LLM call needed.
 */
export function evaluateGoldenTest(
  test: GoldenTestCase,
  output: string
): GoldenTestResult {
  const lowerOutput = output.toLowerCase();
  const matchedPatterns: string[] = [];
  const missedPatterns: string[] = [];
  const forbiddenFound: string[] = [];

  // Check required patterns
  for (const pattern of test.expectedPatterns) {
    if (lowerOutput.includes(pattern.toLowerCase())) {
      matchedPatterns.push(pattern);
    } else {
      missedPatterns.push(pattern);
    }
  }

  // Check forbidden patterns
  if (test.forbiddenPatterns) {
    for (const pattern of test.forbiddenPatterns) {
      if (lowerOutput.includes(pattern.toLowerCase())) {
        forbiddenFound.push(pattern);
      }
    }
  }

  // Calculate score
  const patternScore = test.expectedPatterns.length > 0
    ? (matchedPatterns.length / test.expectedPatterns.length) * 70 // 70% weight for patterns
    : 70;

  const lengthScore = output.length >= test.minOutputLength ? 20 : // 20% weight for length
    (output.length / test.minOutputLength) * 20;

  const forbiddenPenalty = forbiddenFound.length * 10; // -10 per forbidden pattern found

  const score = Math.max(0, Math.min(100, Math.round(patternScore + lengthScore - forbiddenPenalty)));
  const passed = score >= 60 && forbiddenFound.length === 0;

  const details = [
    `Patterns: ${matchedPatterns.length}/${test.expectedPatterns.length} matched`,
    missedPatterns.length > 0 ? `Missed: ${missedPatterns.join(', ')}` : null,
    forbiddenFound.length > 0 ? `Forbidden found: ${forbiddenFound.join(', ')}` : null,
    `Output length: ${output.length} (min: ${test.minOutputLength})`,
  ].filter(Boolean).join(' | ');

  return {
    testId: test.id,
    testName: test.name,
    passed,
    score,
    matchedPatterns,
    missedPatterns,
    forbiddenFound,
    outputLength: output.length,
    details,
  };
}

/**
 * Run all golden tests against a pipeline output.
 * Returns aggregated results.
 */
export function runGoldenTestSuite(
  outputs: Map<string, string> // testId → agent output
): GoldenTestSuiteResult {
  const results: GoldenTestResult[] = [];

  for (const test of GOLDEN_TESTS) {
    const output = outputs.get(test.id) || '';
    if (output) {
      results.push(evaluateGoldenTest(test, output));
    }
  }

  const passed = results.filter(r => r.passed).length;

  return {
    totalTests: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    avgScore: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
    results,
    executedAt: new Date().toISOString(),
  };
}
