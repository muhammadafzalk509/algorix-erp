import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { ScanService } from './scan.service';

@Global()
@Module({
  providers: [R2Service, ScanService],
  exports: [R2Service, ScanService],
})
export class StorageModule {}
