// ============================================================
// Unit Tests — Connectors Module
// Tests connector definitions and notification dispatching.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AVAILABLE_CONNECTORS,
  sendSlackNotification,
  sendDiscordNotification,
  sendWebhookNotification,
  dispatchNotification,
  type Connector,
  type ConnectorType,
} from '@/lib/connectors';

describe('AVAILABLE_CONNECTORS', () => {
  it('contains all 5 connector types', () => {
    expect(AVAILABLE_CONNECTORS).toHaveLength(5);
    const types = AVAILABLE_CONNECTORS.map(c => c.type);
    expect(types).toContain('slack');
    expect(types).toContain('github');
    expect(types).toContain('email');
    expect(types).toContain('webhook');
    expect(types).toContain('discord');
  });

  it('all connectors are disabled by default', () => {
    for (const conn of AVAILABLE_CONNECTORS) {
      expect(conn.enabled).toBe(false);
    }
  });

  it('each connector has required metadata', () => {
    for (const conn of AVAILABLE_CONNECTORS) {
      expect(conn.id).toBeTruthy();
      expect(conn.name).toBeTruthy();
      expect(conn.description).toBeTruthy();
      expect(conn.icon).toBeTruthy();
    }
  });
});

describe('sendSlackNotification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends properly formatted Slack message', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const result = await sendSlackNotification('https://hooks.slack.com/test', {
      title: 'Pipeline Complete',
      message: 'All agents finished',
      status: 'success',
    });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/test', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.text).toContain('✅');
    expect(callBody.text).toContain('Pipeline Complete');
  });

  it('returns false on fetch failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const result = await sendSlackNotification('https://hooks.slack.com/test', {
      title: 'Test', message: 'Test', status: 'info',
    });
    expect(result).toBe(false);
  });

  it('uses correct emoji for error status', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    await sendSlackNotification('https://hooks.slack.com/test', {
      title: 'Failed', message: 'Error occurred', status: 'error',
    });
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.text).toContain('❌');
  });
});

describe('sendDiscordNotification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends properly formatted Discord embed', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const result = await sendDiscordNotification('https://discord.com/api/webhooks/test', {
      title: 'Deploy Complete',
      message: 'Deployment successful',
      status: 'success',
    });

    expect(result).toBe(true);
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.embeds[0].title).toBe('Deploy Complete');
    expect(callBody.embeds[0].color).toBe(0x10b981); // green for success
  });

  it('uses red color for error status', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    await sendDiscordNotification('https://discord.com/api/webhooks/test', {
      title: 'Error', message: 'Failed', status: 'error',
    });
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.embeds[0].color).toBe(0xef4444); // red for error
  });
});

describe('dispatchNotification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only dispatches to enabled connectors', async () => {
    const connectors: Connector[] = [
      { ...AVAILABLE_CONNECTORS[0], enabled: true, config: { webhookUrl: 'https://slack/test' } },
      { ...AVAILABLE_CONNECTORS[1], enabled: false, config: {} },
    ];

    const results = await dispatchNotification(connectors, {
      title: 'Test', message: 'Test', status: 'info',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(results['slack']).toBe(true);
  });

  it('returns empty object for no enabled connectors', async () => {
    const results = await dispatchNotification(AVAILABLE_CONNECTORS, {
      title: 'Test', message: 'Test', status: 'info',
    });
    expect(Object.keys(results)).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
