import { Controller, Get } from '@nestjs/common';
import { FirestoreService } from './firebase/firestore.service';
import { COL } from './common/collections';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly fs: FirestoreService) {}

  @Public()
  @Get('api/health')
  async health() {
    const roles = await this.fs.count(COL.roles);
    const users = await this.fs.count(COL.users);
    return { ok: true, service: 'ALGORIX API', roles, users };
  }
}
