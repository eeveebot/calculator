'use strict';

// Calculator module
// Evaluates mathematical expressions using mathjs

import {
  NatsClient,
  log,
  createNatsConnection,
  registerGracefulShutdown,
  createModuleMetrics,
  loadModuleConfig,
  RateLimitConfig,
  defaultRateLimit,
  initializeSystemMetrics,
  setupHttpServer,
  registerCommand,
  sendChatMessage,
  registerHelp,
  HelpEntry,
  registerStatsHandlers,
  NatsSubscriptionResult,
} from '@eeveebot/libeevee';
import { evaluate } from 'mathjs';
import fs from 'node:fs';

// Record module startup time for uptime tracking
const moduleStartTime = Date.now();
const moduleVersion = JSON.parse(fs.readFileSync(new URL('package.json', 'file://' + process.cwd() + '/'), 'utf8')).version as string;

// Initialize module-scoped metrics recorder
const metrics = createModuleMetrics('calculator');

// Initialize system metrics
initializeSystemMetrics('calculator');



const calcCommandUUID = 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e';
const calcCommandDisplayName = 'calc';

// Calculator module configuration interface
interface CalculatorConfig {
  ratelimit?: RateLimitConfig;
}

const natsClients: InstanceType<typeof NatsClient>[] = [];

// Setup HTTP server for metrics and health checks
setupHttpServer({
  port: process.env.HTTP_API_PORT || '9000',
  serviceName: 'calculator',
  natsClients: natsClients,
});
const natsSubscriptions: Array<Promise<NatsSubscriptionResult>> = [];

// Load configuration at startup
const calculatorConfig = loadModuleConfig<CalculatorConfig>({});

// Register graceful shutdown handlers
registerGracefulShutdown(natsClients);

// Setup NATS connection
const nats = await createNatsConnection();
natsClients.push(nats);

// Register the calc command with the router
const commandSubs = await registerCommand(nats, {
  commandUUID: calcCommandUUID,
  commandDisplayName: calcCommandDisplayName,
  regex: '^(calc|c)\\s+',
  ratelimit: calculatorConfig.ratelimit || defaultRateLimit,
}, metrics);
natsSubscriptions.push(...commandSubs);

// Subscribe to command execution messages
const calcCommandSub = nats.subscribe(
  `command.execute.${calcCommandUUID}`,
  (subject, message) => {
    metrics.recordNatsSubscribe(subject);
    const startTime = Date.now();
    try {
      const data = JSON.parse(message.string());
      log.info('Received command.execute for calc', {
        producer: 'calculator',
        platform: data.platform,
        instance: data.instance,
        channel: data.channel,
        user: data.user,
        originalText: data.originalText,
      });

      const expression = data.text.trim();

      // Check for factorial operations which are disabled
      if (expression.includes('!') || expression.includes('factorial')) {
        void sendChatMessage(nats, {
          channel: data.channel,
          network: data.network,
          instance: data.instance,
          platform: data.platform,
          text: 'Error: Factorials disabled',
          trace: data.trace,
        }, metrics);

        metrics.recordCommand(data.platform, data.network, data.channel, 'success');
        return;
      }

      try {
        const result = evaluate(expression);

        void sendChatMessage(nats, {
          channel: data.channel,
          network: data.network,
          instance: data.instance,
          platform: data.platform,
          text: result.toString(),
          trace: data.trace,
        }, metrics);

        metrics.recordCommand(data.platform, data.network, data.channel, 'success');
      } catch (evalError) {
        void sendChatMessage(nats, {
          channel: data.channel,
          network: data.network,
          instance: data.instance,
          platform: data.platform,
          text: `Error: ${(evalError as Error).message}`,
          trace: data.trace,
        }, metrics);

        metrics.recordCommand(data.platform, data.network, data.channel, 'eval_error');
        metrics.recordError('eval_error');
      }
    } catch (error) {
      log.error('Failed to parse message', {
        producer: 'calculator',
        message: message.string(),
        error: error,
      });

      metrics.recordCommand('unknown', 'unknown', 'unknown', 'parse_error');
      metrics.recordError('parse_error');
    } finally {
      const duration = Date.now() - startTime;
      metrics.recordProcessingTime(duration / 1000);
    }
  }
);
natsSubscriptions.push(calcCommandSub);

// Subscribe to stats.uptime and stats.emit.request
const statsSubs = registerStatsHandlers({ nats, moduleName: 'calculator', startTime: moduleStartTime, version: moduleVersion, metrics });
natsSubscriptions.push(...statsSubs);

// Register help information
const calculatorHelp: HelpEntry[] = [
  {
    command: 'calc',
    descr: 'Evaluate a math expression with mathJS',
    params: [
      {
        param: 'expression',
        required: true,
        descr: 'Expression to evaluate',
      },
    ],
  },
  {
    command: 'c',
    descr: 'Alias to calc command',
    params: [
      {
        param: 'expression',
        required: true,
        descr: 'Expression to evaluate',
      },
    ],
  },
];

const helpSubs = await registerHelp(nats, 'calculator', calculatorHelp, metrics);
natsSubscriptions.push(...helpSubs);
