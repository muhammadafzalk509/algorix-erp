import { Injectable, Logger } from '@nestjs/common';

export interface ScanResult {
  clean: boolean;
  reason?: string;
}

/**
 * Pluggable virus-scan hook. No-op in dev (always clean). In production, wire
 * this to ClamAV / VirusTotal / a cloud AV API before persisting an upload.
 */
@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  async scan(buffer: Buffer, filename: string): Promise<ScanResult> {
    // Placeholder: integrate a real scanner here. Kept conceptual per spec.
    this.logger.debug(`Scan (stub) passed: ${filename} (${buffer.length} bytes)`);
    return { clean: true };
  }
}
