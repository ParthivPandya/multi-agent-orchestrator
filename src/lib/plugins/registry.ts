// ============================================================
// Plugin Architecture — Plugin Registry
// Singleton registry that holds all registered plugins.
// Provides registration, lookup, and lifecycle management.
// ============================================================

import { Plugin, PluginType, PluginEvent, PluginMetadata } from './types';

/**
 * Singleton Plugin Registry.
 * Manages all custom plugins (agents, tools, connectors, guardrails).
 */
class PluginRegistryImpl {
  private plugins = new Map<string, Plugin>();
  private eventLog: PluginEvent[] = [];

  /**
   * Register a new plugin. Throws if a plugin with the same name already exists.
   */
  register(plugin: Plugin): void {
    const key = this.pluginKey(plugin.metadata);

    if (this.plugins.has(key)) {
      this.logEvent('error', plugin.metadata.name, plugin.metadata.type,
        `Plugin "${key}" is already registered`);
      throw new Error(`Plugin "${key}" is already registered. Unregister it first.`);
    }

    // Validate plugin structure
    this.validate(plugin);

    this.plugins.set(key, plugin);
    this.logEvent('registered', plugin.metadata.name, plugin.metadata.type);
  }

  /**
   * Unregister a plugin by name and type.
   */
  unregister(name: string, type: PluginType): boolean {
    const key = `${type}:${name}`;
    if (this.plugins.has(key)) {
      this.plugins.delete(key);
      this.logEvent('unregistered', name, type);
      return true;
    }
    return false;
  }

  /**
   * Get a specific plugin by name and type.
   */
  get(name: string, type: PluginType): Plugin | undefined {
    return this.plugins.get(`${type}:${name}`);
  }

  /**
   * Get all plugins of a specific type.
   */
  getByType(type: PluginType): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(p => p.metadata.type === type);
  }

  /**
   * List all registered plugins.
   */
  list(): PluginMetadata[] {
    return Array.from(this.plugins.values())
      .map(p => p.metadata);
  }

  /**
   * Check if a plugin is registered.
   */
  has(name: string, type: PluginType): boolean {
    return this.plugins.has(`${type}:${name}`);
  }

  /**
   * Get the total number of registered plugins.
   */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Get all plugin agent names (for flow integration).
   */
  getAgentNames(): string[] {
    return this.getByType('agent').map(p => p.metadata.name);
  }

  /**
   * Get the event log (for debugging).
   */
  getEventLog(): PluginEvent[] {
    return [...this.eventLog];
  }

  /**
   * Clear all registered plugins.
   */
  clear(): void {
    this.plugins.clear();
    this.eventLog = [];
  }

  // ─── Internal Helpers ──────────────────────────────────────

  private pluginKey(metadata: PluginMetadata): string {
    return `${metadata.type}:${metadata.name}`;
  }

  private validate(plugin: Plugin): void {
    const { metadata } = plugin;

    if (!metadata.name || !metadata.version || !metadata.type) {
      throw new Error('Plugin must have name, version, and type in metadata');
    }

    if (!['agent', 'tool', 'connector', 'guardrail'].includes(metadata.type)) {
      throw new Error(`Invalid plugin type: ${metadata.type}`);
    }

    // Type-specific validation
    if (metadata.type === 'agent' && !plugin.agent) {
      throw new Error('Agent plugins must include an "agent" configuration');
    }
    if (metadata.type === 'tool' && !plugin.tool) {
      throw new Error('Tool plugins must include a "tool" configuration');
    }
    if (metadata.type === 'connector' && !plugin.connector) {
      throw new Error('Connector plugins must include a "connector" configuration');
    }
    if (metadata.type === 'guardrail' && !plugin.guardrail) {
      throw new Error('Guardrail plugins must include a "guardrail" configuration');
    }
  }

  private logEvent(type: PluginEvent['type'], name: string, pluginType: PluginType, error?: string): void {
    this.eventLog.push({
      type,
      pluginName: name,
      pluginType,
      timestamp: Date.now(),
      error,
    });
  }
}

// ─── Singleton Export ────────────────────────────────────────

/** Global plugin registry instance */
export const PluginRegistry = new PluginRegistryImpl();

/**
 * Helper to create and register a plugin in one call.
 */
export function createPlugin(plugin: Plugin): Plugin {
  PluginRegistry.register(plugin);
  return plugin;
}
