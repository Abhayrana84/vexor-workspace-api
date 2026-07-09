import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@vexor/db';
import { tenantLocalStorage } from '../../common/tenant-context';

@Injectable()
export class DbService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private extendedClient: any;

  constructor() {
    super();
    
    // Configure Prisma Client Extension to automatically filter queries by organizationId
    this.extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const context = tenantLocalStorage.getStore();
            const organizationId = context?.organizationId;

            // Enforce organization isolation filter on all multi-tenant tables
            const tenantModels = ['User', 'ClientProfile', 'Lead', 'Project', 'Invoice', 'WebMonitor', 'Automation'];
            if (organizationId && tenantModels.includes(model)) {
              args.where = args.where || {};
              
              if (operation === 'create') {
                args.data = args.data || {};
                args.data.organizationId = organizationId;
              } else if (operation === 'createMany') {
                if (Array.isArray(args.data)) {
                  for (const item of args.data) {
                    item.organizationId = organizationId;
                  }
                } else if (args.data) {
                  args.data.organizationId = organizationId;
                }
              } else {
                args.where.organizationId = organizationId;
              }
            }
            return query(args);
          },
        },
      },
    });

    // Proxy accesses to database model properties through the extended Prisma client
    return new Proxy(this, {
      get(target: any, prop: string | symbol, receiver: any) {
        if (prop in target.extendedClient) {
          return target.extendedClient[prop as any];
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
