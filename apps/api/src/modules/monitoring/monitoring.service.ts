import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private checkerInterval: NodeJS.Timeout | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisConnection: IORedis | null = null;

  constructor(private db: DbService) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      this.logger.log('Redis URL detected. Initializing BullMQ uptime monitoring workers...');
      try {
        this.redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
        
        // Define BullMQ queue
        this.queue = new Queue('uptime-monitoring', { connection: this.redisConnection as any });
        
        // Setup Worker to run uptime checks concurrently
        this.worker = new Worker('uptime-monitoring', async (job) => {
          const { monitorId } = job.data;
          const monitor = await this.db.webMonitor.findUnique({ where: { id: monitorId } });
          if (monitor && monitor.isActive) {
            await this.pingWebsite(monitor);
          }
        }, { 
          connection: this.redisConnection as any,
          concurrency: 5,
        });

        this.worker.on('failed', (job, err) => {
          this.logger.error(`Job ${job?.id} failed with error: ${err.message}`);
        });

        // Trigger queue additions every 60 seconds
        this.checkerInterval = setInterval(async () => {
          try {
            const activeMonitors = await this.db.webMonitor.findMany({ where: { isActive: true } });
            for (const monitor of activeMonitors) {
              await this.queue?.add('ping-check', 
                { monitorId: monitor.id },
                { attempts: 3, backoff: 5000, removeOnComplete: true }
              );
            }
          } catch (err: any) {
            this.logger.error(`Failed to push monitors to queue: ${err.message}`);
          }
        }, 60000);

      } catch (err: any) {
        this.logger.error(`BullMQ initialization failed: ${err.message}. Falling back to async intervals.`);
        this.startIntervalFallback();
      }
    } else {
      this.logger.log('No REDIS_URL configured. Running uptime checks in async non-blocking cycles.');
      this.startIntervalFallback();
    }
  }

  private startIntervalFallback() {
    this.checkerInterval = setInterval(() => {
      this.runPingChecksAsync();
    }, 60000);
  }

  private async runPingChecksAsync() {
    try {
      const activeMonitors = await this.db.webMonitor.findMany({ where: { isActive: true } });
      // Execute pings concurrently via Promise chains to avoid blocking the NestJS event loop
      activeMonitors.forEach((monitor) => {
        this.pingWebsite(monitor).catch((err) => {
          this.logger.error(`Async check failed for ${monitor.name}: ${err.message}`);
        });
      });
    } catch (err: any) {
      this.logger.error(`Failed to fetch monitors for ping check: ${err.message}`);
    }
  }

  onModuleDestroy() {
    if (this.checkerInterval) {
      clearInterval(this.checkerInterval);
    }
    if (this.worker) {
      this.worker.close();
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
    }
  }

  async getMonitors(orgId: string) {
    return this.db.webMonitor.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
  }

  async addMonitor(orgId: string, name: string, url: string) {
    return this.db.webMonitor.create({
      data: {
        name,
        url,
        organizationId: orgId,
        isActive: true,
      },
    });
  }

  async triggerManualPing(monitorId: string) {
    const monitor = await this.db.webMonitor.findUnique({ where: { id: monitorId } });
    if (!monitor) throw new Error('Monitor not found');

    return this.pingWebsite(monitor);
  }

  private async pingWebsite(monitor: any) {
    let status = 500;
    try {
      const response = await fetch(monitor.url, { method: 'GET', signal: AbortSignal.timeout(8000) });
      status = response.status;
    } catch (err) {
      status = 0; // Offline or DNS failure
    }

    const isUp = status >= 200 && status < 400;
    const historicWeight = 0.99;
    const currentWeight = isUp ? 100.0 : 0.0;
    const newRatio = (Number(monitor.uptimeRatio) * historicWeight) + (currentWeight * (1 - historicWeight));

    return this.db.webMonitor.update({
      where: { id: monitor.id },
      data: {
        lastPingStatus: status,
        lastChecked: new Date(),
        uptimeRatio: parseFloat(newRatio.toFixed(2)),
      },
    });
  }
}
